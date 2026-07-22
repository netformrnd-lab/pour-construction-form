(function () {
  'use strict';

  const STORAGE_KEY = 'pourstore-renewal-builder-v2';
  const STORAGE_KEY_V1 = 'pourstore-renewal-builder-v1';
  const ME_STAFF_KEY = 'pourstore-renewal-me-staff-id'; // 기기별 — Firestore 동기화 안 함
  const FOLDER_COLLAPSE_KEY = 'pourstore-renewal-folder-collapsed'; // 기기별 UI 상태
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 휴지통 7일 보관 후 영구 삭제
  const MAX_DEPTH = 3; // 0=대, 1=중, 2=소 (총 3단)
  const STAFF_COLORS = ['#0F1F5C','#03C75A','#D97706','#7C3AED','#DC2626','#0284C7','#DB2777','#059669','#9333EA','#EA580C'];

  // 폰트 토큰 — 역할별 일괄 적용 (state.fontTokens)
  // 오늘의집(ohou.se) 폰트 시스템 — Pretendard 기반
  // 패밀리: Pretendard, 컬러: 본문 #2F3438 / 서브 #888888, 자간 -0.02em ~ -0.04em
  const OHOUSE_FONT_FAMILY = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
  function DEFAULT_FONT_TOKENS() {
    return [
      { id: 'ft-heading',  key: '제목', label: '제목 (heading · 오늘의집)', fontFamily: OHOUSE_FONT_FAMILY, fontSize: '24px', fontWeight: '900', color: '#111111', lineHeight: '1.4',  letterSpacing: '-0.04em' },
      { id: 'ft-emphasis', key: '강조', label: '강조 (emphasis · 오늘의집)', fontFamily: OHOUSE_FONT_FAMILY, fontSize: '16px', fontWeight: '700', color: '#2F3438', lineHeight: '1.45', letterSpacing: '-0.03em' },
      { id: 'ft-body',     key: '본문', label: '본문 (body · 오늘의집)',     fontFamily: OHOUSE_FONT_FAMILY, fontSize: '14px', fontWeight: '400', color: '#2F3438', lineHeight: '1.5',  letterSpacing: '-0.02em' },
      { id: 'ft-sub',      key: '서브', label: '서브 (sub · 오늘의집)',      fontFamily: OHOUSE_FONT_FAMILY, fontSize: '12px', fontWeight: '500', color: '#888888', lineHeight: '1.5',  letterSpacing: '-0.02em' },
    ];
  }
  // 클래스 이름에 안전하지 않은 문자 제거 (한글/영문/숫자/하이픈/언더스코어만 허용)
  function sanitizeRoleKey(k) {
    return String(k || '').trim().replace(/[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_-]/g, '');
  }

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU',
    authDomain: 'pour-app-new.firebaseapp.com',
    projectId: 'pour-app-new',
    storageBucket: 'pour-app-new.firebasestorage.app',
    messagingSenderId: '411031141847',
    appId: '1:411031141847:web:e658174fd4b9652cdadf92',
  };
  const FIRESTORE_COLLECTION = 'pourstore-renewal-builder';
  const FIRESTORE_DOC = 'state';
  const HISTORY_SUBCOL = 'history';   // pourstore-renewal-builder/state/history/{safeKey}
  const STATE_CHUNK_SUBCOL = 'state-chunks'; // pourstore-renewal-builder/state/state-chunks/{seq}
  // Firestore 단일 문서/필드 한도는 약 1,048,576 bytes.
  // 메인 state JSON 이 한도를 넘으면 청크로 쪼개 서브컬렉션에 분산 저장한다.
  const STATE_INLINE_MAX_BYTES = 900000;  // 이 byte 이하면 메인 doc state 필드에 그대로 저장
  const STATE_CHUNK_CHARS = 280000;       // 청크당 문자 수 (한글 3byte 가정 시 최대 ~840KB < 1MB)
  const SAVE_DEBOUNCE_MS = 600;
  const HISTORY_BATCH_LIMIT = 400;    // Firestore batch는 500ops 제한 → 여유

  let db = null;
  let firebaseReady = false;
  let saveTimer = null;
  let initialSnapshotConsumed = false;
  let firstSnapshotLoaded = false;
  let lastKnownChunkCount = null; // 메인 state 청크 개수 추적 (null=미상) — 불필요한 정리 조회 방지
  const historyWriteTimers = {};

  const SEED_STATS_HTML =
    '<section style="background:linear-gradient(180deg,#0A1742 0%,#0F1F5C 100%); padding:0; margin:0; position:relative; overflow:hidden;">\n' +
    '  <iframe src="./pour-store-cafe24.html"\n' +
    '          title="POUR스토어 실적관 (전국 시공 현장 · 신뢰의 숫자 · 협력사)"\n' +
    '          loading="lazy"\n' +
    '          style="width:100%; height:100vh; border:0; display:block; background:transparent;"></iframe>\n' +
    '</section>';

  const POUR_STATS_NATIVE_HTML = `<section class="pst2">
<style>
.pst2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pst2 { background:#FFFBF5; padding:80px 18px; letter-spacing:-0.02em; }
.pst2-inner { max-width:1200px; margin:0 auto; }
.pst2-top { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:22px; }
.pst2-kicker { font-size:12px; font-weight:800; color:#E8780F; letter-spacing:0.14em; }
.pst2-note { font-size:13px; font-weight:500; color:#8B95A1; }
.pst2-note b { color:#E8780F; font-weight:800; }
.pst2-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:64px; }
.pst2-stat { background:#fff; border:1px solid #F3E7D5; border-radius:20px; padding:26px 24px; box-shadow:0 6px 18px rgba(232,120,15,.06); }
.pst2-stat .lbl { font-size:12px; font-weight:800; color:#E8780F; letter-spacing:0.1em; margin-bottom:14px; }
.pst2-stat .num { display:flex; align-items:baseline; gap:4px; }
.pst2-stat .num b { font-size:38px; font-weight:900; color:#0F1F5C; letter-spacing:-0.03em; line-height:1; }
.pst2-stat .num span { font-size:15px; font-weight:700; color:#0F1F5C; }
.pst2-stat .sub { margin-top:12px; font-size:12.5px; font-weight:500; color:#8B95A1; line-height:1.5; word-break:keep-all; }
.pst2-gal-head { margin-bottom:24px; }
.pst2-gk { display:inline-flex; align-items:center; gap:10px; font-size:11.5px; font-weight:800; color:#E8780F; letter-spacing:0.16em; margin-bottom:12px; }
.pst2-gk::before { content:''; width:26px; height:2px; background:#E8780F; }
.pst2-gal-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-0.04em; line-height:1.2; }
.pst2-gal-head h2 span { font-size:15px; font-weight:500; color:#8B95A1; letter-spacing:-0.02em; margin-left:10px; }
.pst2-gal { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.pst2-card { display:block; border-radius:18px; overflow:hidden; aspect-ratio:4/3; background:#EEE; box-shadow:0 6px 18px rgba(15,31,92,.08); border:1px solid #F3F4F6; transition:transform .25s ease, box-shadow .25s ease; }
.pst2-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.16); }
.pst2-img { width:100%; height:100%; background:#0F1F5C center/cover no-repeat; }
.pst2-logo-head { margin-top:64px; margin-bottom:24px; }
.pst2-logos { display:flex; flex-direction:column; gap:14px; overflow:hidden; }
.pst2-logo-row { overflow:hidden; -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 6%, #000 94%, transparent 100%); mask-image:linear-gradient(90deg, transparent 0, #000 6%, #000 94%, transparent 100%); }
.pst2-logo-track { display:flex; gap:14px; width:max-content; will-change:transform; }
.pst2-row-right .pst2-logo-track { animation:pst2MarqRight linear infinite; }
.pst2-row-left .pst2-logo-track { animation:pst2MarqLeft linear infinite; }
.pst2-logos:hover .pst2-logo-track { animation-play-state:paused; }
@keyframes pst2MarqLeft { from { transform:translateX(0); } to { transform:translateX(-50%); } }
@keyframes pst2MarqRight { from { transform:translateX(-50%); } to { transform:translateX(0); } }
.pst2-logo { flex:0 0 150px; width:150px; height:88px; display:flex; align-items:center; justify-content:center; background:#fff; border:1px solid #F3E7D5; border-radius:14px; padding:14px 18px; box-shadow:0 4px 12px rgba(232,120,15,.05); }
.pst2-logo img { max-width:100%; max-height:100%; object-fit:contain; filter:grayscale(1); opacity:.72; }
.pst2-logo.pst2-logo-fallback { font-size:12px; font-weight:700; color:#8B95A1; text-align:center; word-break:keep-all; line-height:1.3; }
@media (prefers-reduced-motion:reduce) { .pst2-logo-track { animation:none !important; } }
.pst2-swipe { display:none; }
@keyframes pst2SwipeAr { 0%,100% { transform:translateX(0); } 50% { transform:translateX(4px); } }
@media (max-width:880px) {
  .pst2-stats { grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:48px; }
  .pst2-gal { grid-template-columns:repeat(3,1fr); }
  .pst2-gal-head h2 { font-size:24px; }
  .pst2-gal-head h2 span { display:block; margin-left:0; margin-top:6px; font-size:13px; }
  .pst2-logo-head { margin-top:48px; }
  .pst2-logo-head h2 { font-size:24px; }
  .pst2-logo-head h2 span { display:block; margin-left:0; margin-top:6px; font-size:13px; }
}
@media (max-width:640px) {
  .pst2 { padding:48px 0 56px; }
  .pst2-inner { max-width:none; }
  .pst2-top, .pst2-stats, .pst2-gal-head, .pst2-logo-head { padding-left:18px; padding-right:18px; }
  .pst2-stat .num b { font-size:30px; }
  .pst2-gal { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; -ms-overflow-style:none; gap:12px; padding:0 18px 8px; }
  .pst2-gal::-webkit-scrollbar { display:none; }
  .pst2-card { flex:0 0 64%; max-width:280px; scroll-snap-align:center; aspect-ratio:4/5.1; }
  .pst2-swipe { display:flex; align-items:center; justify-content:center; gap:6px; margin:10px 18px 0; font-size:12px; font-weight:700; color:#E8780F; }
  .pst2-swipe .ar { display:inline-block; animation:pst2SwipeAr 1.3s ease-in-out infinite; }
  .pst2-logos { gap:10px; }
  .pst2-logo { flex-basis:120px; width:120px; height:70px; padding:10px 14px; border-radius:11px; }
}
</style>
<div class="pst2-inner">
  <div class="pst2-top"><span class="pst2-kicker">POUR스토어 실적</span><span class="pst2-note">아파트·공장·병원·관공서에서 <b>사용 중</b></span></div>
  <div class="pst2-stats"><div class="pst2-stat"><div class="lbl">누적 시공</div><div class="num"><b>2,600,000</b><span>세대</span></div><div class="sub">아파트·공장·병원·관공서</div></div><div class="pst2-stat"><div class="lbl">보유 특허</div><div class="num"><b>70</b><span>여 개</span></div><div class="sub">건축물 유지보수 관련 자체 특허</div></div><div class="pst2-stat"><div class="lbl">제품 라인업</div><div class="num"><b>110</b><span>여 개</span></div><div class="sub">R&D 자체 개발 유지보수 제품</div></div><div class="pst2-stat"><div class="lbl">시공 협력사</div><div class="num"><b>250</b><span>여 곳</span></div><div class="sub">전국 검증된 전문 시공 네트워크</div></div></div>
  <div class="pst2-gal-head"><span class="pst2-gk">CONSTRUCTION GALLERY</span><h2>전국 시공 현장 <span>직접 시공한 현장들입니다</span></h2></div>
  <div class="pst2-gal" data-pst2-gal></div>
  <div class="pst2-swipe">옆으로 밀어 더 보기 <span class="ar">→</span></div>
  <div class="pst2-logo-head"><span class="pst2-gk">PARTNERS</span><h2>함께한 시공 협력사 <span>전국 250여 곳과 함께합니다</span></h2></div>
  <div class="pst2-logos" data-pst2-logos></div>
</div>
<script>
(function(){
  var root = document.currentScript && document.currentScript.parentElement;
  if(!root) return;
  var g = root.querySelector('[data-pst2-gal]'); if(!g) return;
  var imgs = ['https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F15b49f57ee357.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F2947421fc5f48.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F29aa19f8601ee.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F32abb25f8678a.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F392c65f8e3085.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F3de8628ad463a.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F4bac2050a3d21.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F4f3fd524afd55.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F633281b2a4416.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F8202321a9069d.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F93f3fb0d576fd.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2F9f803bd67b921.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2Fa5b7f9da035af.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2Fc2f7d57bc599d.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2Fd3cea2787945e.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2Fdaa13cd70fed3.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2Fed8d18d5f230b.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2Fedf2d48381c4c.png?alt=media','https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%EC%95%84%ED%8C%8C%ED%8A%B8%2C%20%EA%B3%B5%EC%9E%A5%2C%20%EB%B3%91%EC%9B%90~%20%2C%2C%20%EC%97%AC%EB%9F%AC%ED%98%91%EB%A0%A5%EC%82%AC%EC%82%AC%EC%9A%A9%EC%A4%91%2Ff8ae7d285b05e.png?alt=media'];
  imgs.forEach(function(u){
    var a = document.createElement('a');
    a.className = 'pst2-card';
    a.href = 'https://www.pourstore.net';
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'POUR스토어 시공 현장');
    var sp = document.createElement('span');
    sp.className = 'pst2-img';
    sp.style.backgroundImage = 'url("' + u + '")';
    a.appendChild(sp);
    g.appendChild(a);
  });
  var lg = root.querySelector('[data-pst2-logos]');
  if (lg) {
    var logos = [{n:'석민이앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%23%EC%84%9D%EB%AF%BC%EC%9D%B4%EC%95%A4%EC%94%A8.png?alt=media'},{n:'썬시카방수',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%23%EC%8D%AC%EC%8B%9C%EC%B9%B4%EB%B0%A9%EC%88%98.png?alt=media'},{n:'(주)대신엘엔씨건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%EB%8C%80%EC%8B%A0%EC%97%98%EC%97%94%EC%94%A8%EA%B1%B4%EC%84%A4%20%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'(주)도경',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%EB%8F%84%EA%B2%BD.jpg?alt=media'},{n:'(주)보람C&C',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%EB%B3%B4%EB%9E%8CC%26C.png?alt=media'},{n:'(주)에이피티건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%EC%97%90%EC%9D%B4%ED%94%BC%ED%8B%B0%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'(주)예신건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%EC%98%88%EC%8B%A0%EA%B1%B4%EC%84%A4-%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'(주)정문씨앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%EC%A0%95%EB%AC%B8%EC%94%A8%EC%95%A4%EC%94%A8-%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'(주)지호건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%EC%A7%80%ED%98%B8%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'(주)진성이엔지',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%EC%A7%84%EC%84%B1%EC%9D%B4%EC%97%94%EC%A7%80-%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'(주)파가니건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%28%EC%A3%BC%29%ED%8C%8C%EA%B0%80%EB%8B%88%EA%B1%B4%EC%84%A4.jpg?alt=media'},{n:'K.B건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2Fk.b%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'강남이앤알',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EA%B0%95%EB%82%A8%EC%9D%B4%EC%95%A4%EC%95%8C.png?alt=media'},{n:'건인씨엔알',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EA%B1%B4%EC%9D%B8%EC%94%A8%EC%97%94%EC%95%8C.png?alt=media'},{n:'건축성능원',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EA%B1%B4%EC%B6%95%EC%84%B1%EB%8A%A5%EC%9B%90.png?alt=media'},{n:'과기대',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EA%B3%BC%EA%B8%B0%EB%8C%80.png?alt=media'},{n:'국일구조',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EA%B5%AD%EC%9D%BC%EA%B5%AC%EC%A1%B0.png?alt=media'},{n:'금환기업',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EA%B8%88%ED%99%98%EA%B8%B0%EC%97%85.png?alt=media'},{n:'다온',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%8B%A4%EC%98%A8.png?alt=media'},{n:'대성이앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%8C%80%EC%84%B1%EC%9D%B4%EC%95%A4%EC%94%A8.png?alt=media'},{n:'대표건설(주)',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%8C%80%ED%91%9C%EA%B1%B4%EC%84%A4%28%EC%A3%BC%29.png?alt=media'},{n:'도원씨엔씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%8F%84%EC%9B%90%EC%94%A8%EC%97%94%EC%94%A8.png?alt=media'},{n:'동양에폭시',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%8F%99%EC%96%91%EC%97%90%ED%8F%AD%EC%8B%9C.png?alt=media'},{n:'동현이앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%8F%99%ED%98%84%EC%9D%B4%EC%95%A4%EC%94%A8.png?alt=media'},{n:'드림종합건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%93%9C%EB%A6%BC%EC%A2%85%ED%95%A9%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'디엘씨엔씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%94%94%EC%97%98%EC%94%A8%EC%97%94%EC%94%A8.png?alt=media'},{n:'레인보우테크',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%A0%88%EC%9D%B8%EB%B3%B4%EC%9A%B0%ED%85%8C%ED%81%AC.png?alt=media'},{n:'로토텍다이아몬드건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%A1%9C%ED%86%A0%ED%85%8D%EB%8B%A4%EC%9D%B4%EC%95%84%EB%AA%AC%EB%93%9C%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'루아이앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%A3%A8%EC%95%84%EC%9D%B4%EC%95%A4%EC%94%A8.png?alt=media'},{n:'명가종합건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%AA%85%EA%B0%80%EC%A2%85%ED%95%A9%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'명하건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%AA%85%ED%95%98%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'방수존건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%B0%A9%EC%88%98%EC%A1%B4%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'백승',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%B0%B1%EC%8A%B9.png?alt=media'},{n:'보라씨엔씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%B3%B4%EB%9D%BC%EC%94%A8%EC%97%94%EC%94%A8.png?alt=media'},{n:'부영씨엔씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EB%B6%80%EC%98%81%EC%94%A8%EC%97%94%EC%94%A8.png?alt=media'},{n:'삼우건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%82%BC%EC%9A%B0%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'삼원건설(주)',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%82%BC%EC%9B%90%EA%B1%B4%EC%84%A4%28%EC%A3%BC%29.png?alt=media'},{n:'삼인유엔아이',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%82%BC%EC%9D%B8%EC%9C%A0%EC%97%94%EC%95%84%EC%9D%B4.png?alt=media'},{n:'삼창엔지니어링',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%82%BC%EC%B0%BD%EC%97%94%EC%A7%80%EB%8B%88%EC%96%B4%EB%A7%81.png?alt=media'},{n:'새로이건설(주)',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%83%88%EB%A1%9C%EC%9D%B4%EA%B1%B4%EC%84%A4%28%EC%A3%BC%29.png?alt=media'},{n:'석진건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%84%9D%EC%A7%84%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'선재기업',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%84%A0%EC%9E%AC%EA%B8%B0%EC%97%85.png?alt=media'},{n:'성훈종합건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%84%B1%ED%9B%88%EC%A2%85%ED%95%A9%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'수산기업',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%88%98%EC%82%B0%EA%B8%B0%EC%97%85.png?alt=media'},{n:'신양아이엔지건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%8B%A0%EC%96%91%EC%95%84%EC%9D%B4%EC%97%94%EC%A7%80%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'신한건설산업(주)',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%8B%A0%ED%95%9C%EA%B1%B4%EC%84%A4%EC%82%B0%EC%97%85%28%EC%A3%BC%29.png?alt=media'},{n:'알지씨앤씨(주)',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%95%8C%EC%A7%80%EC%94%A8%EC%95%A4%EC%94%A8%28%EC%A3%BC%29.png?alt=media'},{n:'에스피플레닝',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%97%90%EC%8A%A4%ED%94%BC%ED%94%8C%EB%A0%88%EB%8B%9D.png?alt=media'},{n:'엘케이개발',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%97%98%EC%BC%80%EC%9D%B4%EA%B0%9C%EB%B0%9C.png?alt=media'},{n:'엠에스이엔지',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%97%A0%EC%97%90%EC%8A%A4%EC%9D%B4%EC%97%94%EC%A7%80.png?alt=media'},{n:'영성건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%98%81%EC%84%B1%EA%B1%B4%EC%84%A4-%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'영성조경',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%98%81%EC%84%B1%EC%A1%B0%EA%B2%BD.png?alt=media'},{n:'예운',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%98%88%EC%9A%B4.png?alt=media'},{n:'우영엘디아이',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%9A%B0%EC%98%81%EC%97%98%EB%94%94%EC%95%84%EC%9D%B4.png?alt=media'},{n:'우주티앤아이',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%9A%B0%EC%A3%BC%ED%8B%B0%EC%95%A4%EC%95%84%EC%9D%B4.png?alt=media'},{n:'은성이엔씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%9D%80%EC%84%B1%EC%9D%B4%EC%97%94%EC%94%A8.png?alt=media'},{n:'이두건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%9D%B4%EB%91%90%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'이루미건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%9D%B4%EB%A3%A8%EB%AF%B8%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'이음건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%9D%B4%EC%9D%8C%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'자연담은건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%9E%90%EC%97%B0%EB%8B%B4%EC%9D%80%EA%B1%B4%EC%84%A4.jpg?alt=media'},{n:'제비스코',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%A0%9C%EB%B9%84%EC%8A%A4%EC%BD%94.png?alt=media'},{n:'종명건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%A2%85%EB%AA%85%EA%B1%B4%EC%84%A4-%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'주원디엔피',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%A3%BC%EC%9B%90%EB%94%94%EC%97%94%ED%94%BC%20%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'지앤필드',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%A7%80%EC%95%A4%ED%95%84%EB%93%9C.png?alt=media'},{n:'진원피앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%A7%84%EC%9B%90%ED%94%BC%EC%95%A4%EC%94%A8.png?alt=media'},{n:'청우엔지니어링',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%B2%AD%EC%9A%B0%EC%97%94%EC%A7%80%EB%8B%88%EC%96%B4%EB%A7%81.jpg?alt=media'},{n:'초담건설(주)',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%B4%88%EB%8B%B4%EA%B1%B4%EC%84%A4%28%EC%A3%BC%29.png?alt=media'},{n:'케이원',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%BC%80%EC%9D%B4%EC%9B%90%20%EB%A1%9C%EA%B3%A0%20%ED%88%AC%EB%AA%85.png?alt=media'},{n:'코지건설(주)',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%EC%BD%94%EC%A7%80%EA%B1%B4%EC%84%A4%20%EC%A3%BC%EC%8B%9D%ED%9A%8C%EC%82%AC-%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'탑이앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%83%91%EC%9D%B4%EC%95%A4%EC%94%A8.png?alt=media'},{n:'탱크마스타',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%83%B1%ED%81%AC%EB%A7%88%EC%8A%A4%ED%83%80.png?alt=media'},{n:'파가니건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%8C%8C%EA%B0%80%EB%8B%88%EA%B1%B4%EC%84%A4.png?alt=media'},{n:'한별이엔씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%95%9C%EB%B3%84%EC%9D%B4%EC%97%94%EC%94%A8.png?alt=media'},{n:'현대도건',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%98%84%EB%8C%80%EB%8F%84%EA%B1%B4.png?alt=media'},{n:'혜성씨앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%98%9C%EC%84%B1%EC%94%A8%EC%95%A4%EC%94%A8.png?alt=media'},{n:'효덕산업',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%9A%A8%EB%8D%95%EC%82%B0%EC%97%85.png?alt=media'},{n:'효성씨앤씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%9A%A8%EC%84%B1%EC%94%A8%EC%95%A4%EC%94%A8-%EB%A1%9C%EA%B3%A0.png?alt=media'},{n:'효원이엔씨',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%9A%A8%EC%9B%90%EC%9D%B4%EC%97%94%EC%94%A8.png?alt=media'},{n:'흥산건설산업',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%9D%A5%EC%82%B0%EA%B1%B4%EC%84%A4%EC%82%B0%EC%97%85.png?alt=media'},{n:'희민건설',u:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4_%EB%A6%AC%EB%89%B4%EC%96%BC%2F%EC%9E%90%EC%82%AC%EB%AA%B0%2F%ED%98%91%EB%A0%B5%EC%82%AC%20%EB%A1%9C%EA%B3%A0%EB%93%A4%2F%ED%9D%AC%EB%AF%BC%EA%B1%B4%EC%84%A4%EB%A1%9C%EA%B3%A0%20jpg.jpg?alt=media'}];
    logos.forEach(function(o){ o.__cell = null; });
    var ROWS = 4;
    var rows = [[],[],[],[]];
    logos.forEach(function(o, i){ rows[i % ROWS].push(o); });
    function makeCell(o){
      var cell = document.createElement('div');
      cell.className = 'pst2-logo';
      cell.title = o.n;
      var im = document.createElement('img');
      im.src = o.u;
      im.alt = o.n;
      im.loading = 'lazy';
      im.onerror = function(){ cell.classList.add('pst2-logo-fallback'); cell.textContent = o.n; };
      cell.appendChild(im);
      return cell;
    }
    rows.forEach(function(rowLogos, r){
      var row = document.createElement('div');
      row.className = 'pst2-logo-row' + (r % 2 === 0 ? ' pst2-row-right' : ' pst2-row-left');
      var track = document.createElement('div');
      track.className = 'pst2-logo-track';
      // 무한 루프를 위해 같은 세트를 2번 이어붙임
      rowLogos.forEach(function(o){ track.appendChild(makeCell(o)); });
      rowLogos.forEach(function(o){ track.appendChild(makeCell(o)); });
      // 줄 길이에 비례한 속도(개수 많을수록 느리게)
      track.style.animationDuration = (rowLogos.length * 4.2) + 's';
      row.appendChild(track);
      lg.appendChild(row);
    });
  }
})();
</script>
</section>`;


  // ===== B2B 시크릿 대시보드 — 대리점주 =====
  // ===== 대리점 모집 소개 페이지 — 토스 스타일 + POUR 오렌지/네이비 =====
  const SEED_INTRO_DEALER_HTML = `<section class="pin pin-dealer">
<style>
.pin *, .pin *::before, .pin *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pin { background:#fff; color:#191F28; letter-spacing:-0.02em; -webkit-font-smoothing:antialiased; }
.pin a { color:inherit; text-decoration:none; }
.pin button { font:inherit; cursor:pointer; border:none; background:none; color:inherit; letter-spacing:inherit; }
/* 1) Hero */
.pin-hero { background:linear-gradient(135deg,#FFFBF5 0%,#FFEDD5 100%); padding:80px 20px 72px; position:relative; overflow:hidden; }
.pin-hero::before { content:''; position:absolute; top:-100px; right:-80px; width:380px; height:380px; border-radius:50%; background:radial-gradient(circle,rgba(232,120,15,.22) 0%,transparent 65%); pointer-events:none; }
.pin-hero-inner { max-width:720px; margin:0 auto; position:relative; z-index:1; text-align:center; }
.pin-kicker { display:inline-block; font-size:12px; font-weight:800; color:#E8780F; letter-spacing:0.08em; padding:6px 14px; background:#fff; border:1px solid #FED7AA; border-radius:999px; margin-bottom:18px; box-shadow:0 2px 8px rgba(232,120,15,.1); }
.pin-h1 { font-size:36px; font-weight:900; color:#0F1F5C; letter-spacing:-0.045em; line-height:1.25; }
.pin-h1 b { color:#E8780F; }
.pin-sub { margin-top:14px; font-size:15px; font-weight:500; color:#8B95A1; line-height:1.65; letter-spacing:-0.02em; }
.pin-hero-stats { margin-top:32px; display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.pin-hero-stat { background:#fff; border-radius:14px; padding:14px 10px; box-shadow:0 4px 12px rgba(15,31,92,.06); }
.pin-hero-stat-num { font-size:22px; font-weight:900; color:#E8780F; letter-spacing:-0.04em; line-height:1.1; }
.pin-hero-stat-num .unit { font-size:13px; font-weight:800; }
.pin-hero-stat-label { margin-top:4px; font-size:11.5px; font-weight:600; color:#6B7280; letter-spacing:-0.02em; }
/* 2) 섹션 공통 */
.pin-sec { padding:64px 20px; }
.pin-sec.alt { background:#F9FAFB; }
.pin-sec-inner { max-width:720px; margin:0 auto; }
.pin-sec-kicker { display:block; font-size:12px; font-weight:800; color:#E8780F; letter-spacing:0.06em; margin-bottom:8px; text-align:center; }
.pin-sec-title { font-size:26px; font-weight:900; color:#191F28; letter-spacing:-0.045em; line-height:1.3; text-align:center; }
.pin-sec-title b { color:#E8780F; }
.pin-sec-sub { margin-top:10px; text-align:center; font-size:14px; font-weight:500; color:#8B95A1; letter-spacing:-0.02em; line-height:1.65; margin-bottom:32px; }
/* 3) 혜택 카드 */
.pin-benefits { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
.pin-benefit { background:#fff; border:1px solid #F2F4F6; border-radius:16px; padding:22px 20px; transition:.18s; }
.pin-benefit:hover { border-color:#FED7AA; transform:translateY(-2px); box-shadow:0 8px 20px rgba(232,120,15,.08); }
.pin-benefit-ico { width:44px; height:44px; border-radius:12px; background:#FFF7ED; color:#E8780F; display:grid; place-items:center; font-size:20px; margin-bottom:12px; }
.pin-benefit-title { font-size:15px; font-weight:800; color:#191F28; letter-spacing:-0.03em; margin-bottom:6px; }
.pin-benefit-desc { font-size:13px; font-weight:500; color:#6B7280; letter-spacing:-0.02em; line-height:1.6; }
/* 4) 등급제 */
.pin-tiers { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.pin-tier { background:#fff; border:1.5px solid #F2F4F6; border-radius:18px; padding:24px 20px; position:relative; transition:.18s; }
.pin-tier.recommend { border-color:#E8780F; box-shadow:0 8px 24px rgba(232,120,15,.15); }
.pin-tier.recommend::before { content:'추천'; position:absolute; top:-10px; left:50%; transform:translateX(-50%); padding:3px 10px; background:#E8780F; color:#fff; font-size:10.5px; font-weight:800; border-radius:999px; letter-spacing:0.04em; }
.pin-tier-name { font-size:13px; font-weight:800; color:#6B7280; letter-spacing:0.04em; }
.pin-tier.recommend .pin-tier-name { color:#E8780F; }
.pin-tier-margin { margin-top:8px; font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-0.045em; line-height:1; }
.pin-tier-margin .unit { font-size:18px; color:#E8780F; }
.pin-tier-cond { margin-top:6px; font-size:11.5px; color:#9CA3AF; font-weight:600; letter-spacing:-0.02em; }
.pin-tier-list { margin-top:16px; padding-top:16px; border-top:1px solid #F2F4F6; display:flex; flex-direction:column; gap:8px; }
.pin-tier-item { display:flex; gap:6px; align-items:flex-start; font-size:12px; font-weight:600; color:#374151; letter-spacing:-0.02em; line-height:1.5; }
.pin-tier-item::before { content:'✓'; color:#0FA864; font-weight:900; flex-shrink:0; }
/* 5) 절차 */
.pin-steps { display:flex; flex-direction:column; gap:10px; }
.pin-step { display:flex; gap:16px; padding:18px 20px; background:#fff; border:1px solid #F2F4F6; border-radius:14px; align-items:center; }
.pin-step-num { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#F49A3A,#E8780F); color:#fff; font-size:14px; font-weight:900; display:grid; place-items:center; flex-shrink:0; box-shadow:0 4px 10px rgba(232,120,15,.3); }
.pin-step-body { flex:1; }
.pin-step-title { font-size:14px; font-weight:800; color:#191F28; letter-spacing:-0.03em; }
.pin-step-desc { margin-top:3px; font-size:12.5px; font-weight:500; color:#8B95A1; letter-spacing:-0.02em; line-height:1.5; }
.pin-step-time { font-size:11px; font-weight:700; color:#E8780F; flex-shrink:0; }
/* 6) FAQ */
.pin-faqs { display:flex; flex-direction:column; gap:8px; }
.pin-faq { background:#fff; border:1px solid #F2F4F6; border-radius:14px; overflow:hidden; }
.pin-faq summary { padding:18px 20px; font-size:14px; font-weight:700; color:#191F28; letter-spacing:-0.02em; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; }
.pin-faq summary::-webkit-details-marker { display:none; }
.pin-faq summary::after { content:'+'; font-size:18px; color:#E8780F; font-weight:900; transition:.2s; }
.pin-faq[open] summary::after { transform:rotate(45deg); }
.pin-faq-body { padding:0 20px 18px; font-size:13px; font-weight:500; color:#6B7280; line-height:1.7; letter-spacing:-0.02em; }
/* 7) Bottom CTA */
.pin-cta-sec { padding:64px 20px 80px; background:linear-gradient(135deg,#0F1F5C 0%,#1E3A8A 100%); color:#fff; text-align:center; }
.pin-cta-inner { max-width:720px; margin:0 auto; }
.pin-cta-kicker { display:inline-block; font-size:12px; font-weight:800; color:#FED7AA; letter-spacing:0.08em; padding:5px 14px; background:rgba(232,120,15,.2); border:1px solid rgba(232,120,15,.4); border-radius:999px; margin-bottom:16px; }
.pin-cta-title { font-size:28px; font-weight:900; letter-spacing:-0.045em; line-height:1.3; }
.pin-cta-title b { color:#FED7AA; }
.pin-cta-sub { margin-top:12px; font-size:14px; font-weight:500; color:rgba(255,255,255,.78); line-height:1.65; letter-spacing:-0.02em; }
.pin-cta-buttons { margin-top:28px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.pin-cta-primary { padding:16px 32px; background:#E8780F; color:#fff; font-size:15px; font-weight:800; border-radius:999px; box-shadow:0 8px 22px rgba(232,120,15,.4); letter-spacing:-0.03em; transition:.18s; }
.pin-cta-primary:hover { background:#C8650D; transform:translateY(-2px); }
.pin-cta-ghost { padding:16px 28px; background:rgba(255,255,255,.1); color:#fff; font-size:15px; font-weight:700; border-radius:999px; border:1px solid rgba(255,255,255,.2); letter-spacing:-0.03em; transition:.18s; }
.pin-cta-ghost:hover { background:rgba(255,255,255,.2); }
@media (max-width:700px) {
  .pin-hero { padding:56px 18px 48px; }
  .pin-h1 { font-size:26px; }
  .pin-sub { font-size:13.5px; }
  .pin-hero-stat-num { font-size:18px; }
  .pin-sec { padding:48px 18px; }
  .pin-sec-title { font-size:22px; }
  .pin-sec-sub { font-size:13px; }
  .pin-benefits { grid-template-columns:1fr; }
  .pin-tiers { grid-template-columns:1fr; }
  .pin-tier.recommend { order:-1; }
  .pin-cta-sec { padding:48px 18px 60px; }
  .pin-cta-title { font-size:22px; }
  .pin-cta-buttons { flex-direction:column; }
  .pin-cta-primary, .pin-cta-ghost { width:100%; }
}
</style>
<!-- Hero -->
<div class="pin-hero">
  <div class="pin-hero-inner">
    <span class="pin-kicker">DEALER RECRUITMENT</span>
    <h1 class="pin-h1">POUR스토어<br/><b>대리점</b>이 되어보세요</h1>
    <p class="pin-sub">240만 세대가 선택한 POUR 자재를 도매가로 공급받고,<br/>안정적인 마진 + 자동 정산으로 운영하세요.</p>
    <div class="pin-hero-stats">
      <div class="pin-hero-stat"><div class="pin-hero-stat-num">250<span class="unit">+</span></div><div class="pin-hero-stat-label">운영 대리점</div></div>
      <div class="pin-hero-stat"><div class="pin-hero-stat-num">22<span class="unit">~35%</span></div><div class="pin-hero-stat-label">대리점 마진</div></div>
      <div class="pin-hero-stat"><div class="pin-hero-stat-num">98<span class="unit">%</span></div><div class="pin-hero-stat-label">재계약률</div></div>
    </div>
  </div>
</div>
<!-- 혜택 -->
<div class="pin-sec">
  <div class="pin-sec-inner">
    <span class="pin-sec-kicker">BENEFITS</span>
    <h2 class="pin-sec-title">POUR 대리점만의 <b>6가지 혜택</b></h2>
    <p class="pin-sec-sub">대리점 사장님이 운영에만 집중할 수 있도록 본사가 모두 지원합니다</p>
    <div class="pin-benefits">
      <div class="pin-benefit"><div class="pin-benefit-ico">💰</div><div class="pin-benefit-title">최대 35% 마진</div><div class="pin-benefit-desc">등급에 따라 22~35%의 안정적인 마진율. 등급 산정 시 추가 인센티브.</div></div>
      <div class="pin-benefit"><div class="pin-benefit-ico">⚡</div><div class="pin-benefit-title">자동 정산</div><div class="pin-benefit-desc">매월 말 자동 집계 → 익월 5일 입금. 수기 보고 없이 자동 처리.</div></div>
      <div class="pin-benefit"><div class="pin-benefit-ico">📦</div><div class="pin-benefit-title">소량 주문 가능</div><div class="pin-benefit-desc">최소 발주 수량 없음. 필요할 때 필요한 만큼만 주문하세요.</div></div>
      <div class="pin-benefit"><div class="pin-benefit-ico">🎓</div><div class="pin-benefit-title">기술 교육 무상 지원</div><div class="pin-benefit-desc">정기 시공 교육·자재 사용법·CS 응대까지. 본사가 직접 교육.</div></div>
      <div class="pin-benefit"><div class="pin-benefit-ico">📣</div><div class="pin-benefit-title">마케팅 지원</div><div class="pin-benefit-desc">전단·온라인 광고·SNS 콘텐츠 본사 제작. 매장 홍보비 절감.</div></div>
      <div class="pin-benefit"><div class="pin-benefit-ico">🛡</div><div class="pin-benefit-title">하자 책임 분담</div><div class="pin-benefit-desc">자재 하자 발생 시 본사 직접 책임. 대리점이 부담 X.</div></div>
    </div>
  </div>
</div>
<!-- 등급제 -->
<div class="pin-sec alt">
  <div class="pin-sec-inner">
    <span class="pin-sec-kicker">TIER PROGRAM</span>
    <h2 class="pin-sec-title">3단계 <b>등급제</b>로 성장에 맞춰</h2>
    <p class="pin-sec-sub">분기별 매출·재계약률을 기반으로 자동 승급. 등급마다 마진과 혜택이 달라집니다</p>
    <div class="pin-tiers">
      <div class="pin-tier">
        <div class="pin-tier-name">SILVER</div>
        <div class="pin-tier-margin">22<span class="unit">%</span></div>
        <div class="pin-tier-cond">진입 등급 · 매출 무관</div>
        <div class="pin-tier-list">
          <div class="pin-tier-item">기본 마진율 22%</div>
          <div class="pin-tier-item">정기 기술 교육 (분기 1회)</div>
          <div class="pin-tier-item">기본 마케팅 자료</div>
        </div>
      </div>
      <div class="pin-tier recommend">
        <div class="pin-tier-name">GOLD</div>
        <div class="pin-tier-margin">28<span class="unit">%</span></div>
        <div class="pin-tier-cond">월 매출 500만+ · 추천</div>
        <div class="pin-tier-list">
          <div class="pin-tier-item">마진율 28% (+6%p)</div>
          <div class="pin-tier-item">전담 영업 매니저 배정</div>
          <div class="pin-tier-item">우선 신상품 공급</div>
          <div class="pin-tier-item">지역 마케팅 50% 지원</div>
        </div>
      </div>
      <div class="pin-tier">
        <div class="pin-tier-name">PLATINUM</div>
        <div class="pin-tier-margin">35<span class="unit">%</span></div>
        <div class="pin-tier-cond">월 매출 1,500만+</div>
        <div class="pin-tier-list">
          <div class="pin-tier-item">최고 마진율 35%</div>
          <div class="pin-tier-item">독점 권역 보호</div>
          <div class="pin-tier-item">신제품 베타 우선 접근</div>
          <div class="pin-tier-item">B2B 영업 기회 우선 분배</div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- 신청 절차 -->
<div class="pin-sec">
  <div class="pin-sec-inner">
    <span class="pin-sec-kicker">HOW TO APPLY</span>
    <h2 class="pin-sec-title">신청부터 운영까지 <b>5단계</b></h2>
    <p class="pin-sec-sub">평균 14일 이내에 대리점 운영을 시작하실 수 있습니다</p>
    <div class="pin-steps">
      <div class="pin-step"><div class="pin-step-num">1</div><div class="pin-step-body"><div class="pin-step-title">온라인 신청서 작성</div><div class="pin-step-desc">사업자 정보·지역·연락처 등 기본 정보 제출</div></div><div class="pin-step-time">5분</div></div>
      <div class="pin-step"><div class="pin-step-num">2</div><div class="pin-step-body"><div class="pin-step-title">본사 검토 + 전화 상담</div><div class="pin-step-desc">자격 요건 확인 후 영업 담당자가 직접 연락</div></div><div class="pin-step-time">1~2일</div></div>
      <div class="pin-step"><div class="pin-step-num">3</div><div class="pin-step-body"><div class="pin-step-title">현장 실사 + 계약</div><div class="pin-step-desc">매장·창고 점검 후 대리점 계약 체결</div></div><div class="pin-step-time">3~5일</div></div>
      <div class="pin-step"><div class="pin-step-num">4</div><div class="pin-step-body"><div class="pin-step-title">초도 물량 발주 + 기술 교육</div><div class="pin-step-desc">초도 자재 공급 · 시공 교육 · 시스템 가이드</div></div><div class="pin-step-time">3~5일</div></div>
      <div class="pin-step"><div class="pin-step-num">5</div><div class="pin-step-body"><div class="pin-step-title">대시보드 발급 + 운영 시작</div><div class="pin-step-desc">시크릿 페이지·정산 대시보드 발급 · 본격 운영</div></div><div class="pin-step-time">즉시</div></div>
    </div>
  </div>
</div>
<!-- FAQ -->
<div class="pin-sec alt">
  <div class="pin-sec-inner">
    <span class="pin-sec-kicker">FAQ</span>
    <h2 class="pin-sec-title">자주 묻는 질문</h2>
    <p class="pin-sec-sub">신청 전에 가장 많이 받는 질문들입니다</p>
    <div class="pin-faqs">
      <details class="pin-faq"><summary>가입비·보증금이 있나요?</summary><div class="pin-faq-body">가입비는 없습니다. 초도 물량 발주(최소 500만원 권장) 외에 별도 보증금이나 권리금이 없습니다.</div></details>
      <details class="pin-faq"><summary>매장 크기·위치 제한이 있나요?</summary><div class="pin-faq-body">최소 33㎡(10평) 이상이면 신청 가능. 위치는 인접 대리점 5km 이내가 아닌 곳이면 우선 배정됩니다.</div></details>
      <details class="pin-faq"><summary>독점 권역은 어떻게 정해지나요?</summary><div class="pin-faq-body">Platinum 등급부터 권역 독점이 보호됩니다. Silver·Gold는 인접 대리점 거리 5km 기준으로 신규 진입을 제한합니다.</div></details>
      <details class="pin-faq"><summary>정산은 어떻게 받나요?</summary><div class="pin-faq-body">매월 말 17시 기준 매출 집계 → 익월 5일 등록 계좌로 자동 입금. PG 수수료 차감 후 실수령액이 들어옵니다.</div></details>
      <details class="pin-faq"><summary>하자가 발생하면 누가 책임지나요?</summary><div class="pin-faq-body">자재 하자는 POUR 본사가 직접 책임집니다. 대리점이 부담하지 않으며, 본사가 시공 파트너와 직접 소통해 처리합니다.</div></details>
    </div>
  </div>
</div>
<!-- Bottom CTA -->
<div class="pin-cta-sec">
  <div class="pin-cta-inner">
    <span class="pin-cta-kicker">START NOW</span>
    <h2 class="pin-cta-title"><b>5분</b> 만에 신청, <b>14일</b> 만에 운영 시작</h2>
    <p class="pin-cta-sub">POUR스토어 대리점이 되어 안정적인 수익 구조를 만들어보세요</p>
    <div class="pin-cta-buttons">
      <a class="pin-cta-primary" href="https://www.pourstore.net/dealers/apply">대리점 신청하기 →</a>
      <a class="pin-cta-ghost" href="https://www.pourstore.net/dealers/info">자세히 알아보기</a>
    </div>
  </div>
</div>
</section>`;

  const SEED_DASH_DEALER_HTML = `<section class="pdb pdb-dealer">
<style>
.pdb *, .pdb *::before, .pdb *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pdb { background:#fff; padding:32px 20px 80px; color:#191F28; letter-spacing:-0.02em; min-height:100vh; -webkit-font-smoothing:antialiased; }
.pdb-wrap { max-width:720px; margin:0 auto; }
/* 인사 헤더 */
.pdb-hello { margin-bottom:24px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.pdb-hello-text { font-size:22px; font-weight:800; color:#191F28; letter-spacing:-0.04em; line-height:1.4; }
.pdb-hello-text b { color:#E8780F; }
.pdb-hello-sub { margin-top:6px; font-size:13.5px; color:#8B95A1; font-weight:500; letter-spacing:-0.02em; }
.pdb-tier { display:inline-flex; align-items:center; gap:5px; padding:6px 12px; background:#FFF7ED; color:#E8780F; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:0.02em; flex-shrink:0; border:1px solid #FED7AA; }
/* 메인 매출 카드 — 토스 스타일 hero */
.pdb-hero { background:linear-gradient(135deg,#FFFBF5 0%,#FFEDD5 100%); border-radius:20px; padding:28px 24px; margin-bottom:14px; position:relative; overflow:hidden; }
.pdb-hero::after { content:''; position:absolute; top:-40px; right:-40px; width:160px; height:160px; border-radius:50%; background:radial-gradient(circle,rgba(232,120,15,.18) 0%,transparent 65%); pointer-events:none; }
.pdb-hero-label { font-size:13px; font-weight:700; color:#7C2D12; letter-spacing:-0.02em; margin-bottom:8px; position:relative; z-index:1; }
.pdb-hero-num { font-size:36px; font-weight:900; color:#0F1F5C; letter-spacing:-0.045em; line-height:1.1; position:relative; z-index:1; }
.pdb-hero-num .unit { font-size:20px; color:#E8780F; margin-left:2px; font-weight:800; }
.pdb-hero-meta { margin-top:12px; display:flex; gap:14px; align-items:center; position:relative; z-index:1; }
.pdb-hero-delta { font-size:13px; font-weight:800; color:#E8780F; letter-spacing:-0.02em; }
.pdb-hero-date { font-size:12px; color:#8B95A1; font-weight:500; letter-spacing:-0.02em; }
/* 미니 KPI 3개 */
.pdb-minis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:24px; }
.pdb-mini { background:#F9FAFB; border-radius:14px; padding:16px 14px; text-align:center; }
.pdb-mini-num { font-size:20px; font-weight:900; color:#191F28; letter-spacing:-0.04em; line-height:1.1; }
.pdb-mini-num.orange { color:#E8780F; }
.pdb-mini-num.navy { color:#0F1F5C; }
.pdb-mini-num .unit { font-size:13px; font-weight:800; }
.pdb-mini-label { margin-top:6px; font-size:11.5px; color:#8B95A1; font-weight:600; letter-spacing:-0.02em; }
/* CTA 큰 버튼 */
.pdb-cta { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:18px; background:#E8780F; color:#fff; border-radius:14px; font-size:15.5px; font-weight:800; border:none; cursor:pointer; letter-spacing:-0.03em; box-shadow:0 8px 20px rgba(232,120,15,.3); margin-bottom:24px; transition:.18s; }
.pdb-cta:hover { background:#C8650D; transform:translateY(-1px); box-shadow:0 12px 26px rgba(232,120,15,.4); }
.pdb-cta-arrow { font-size:18px; }
/* 빠른 액션 4개 */
.pdb-quick { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:28px; }
.pdb-quick-btn { padding:18px 8px; background:#F9FAFB; border:none; border-radius:14px; text-align:center; cursor:pointer; transition:.15s; display:flex; flex-direction:column; align-items:center; gap:8px; text-decoration:none; color:inherit; }
.pdb-quick-btn:hover { background:#FFF7ED; }
.pdb-quick-ico { font-size:22px; }
.pdb-quick-name { font-size:11.5px; font-weight:700; color:#191F28; letter-spacing:-0.02em; line-height:1.3; }
/* 리스트 카드 */
.pdb-list { background:#fff; border:1px solid #F2F4F6; border-radius:18px; overflow:hidden; margin-bottom:14px; }
.pdb-list-head { display:flex; justify-content:space-between; align-items:center; padding:18px 20px 14px; }
.pdb-list-title { font-size:15px; font-weight:800; color:#191F28; letter-spacing:-0.03em; }
.pdb-list-more { font-size:12.5px; color:#8B95A1; font-weight:600; text-decoration:none; letter-spacing:-0.02em; }
.pdb-list-more:hover { color:#E8780F; }
.pdb-row { display:flex; align-items:center; gap:12px; padding:14px 20px; border-top:1px solid #F2F4F6; transition:.15s; }
.pdb-row:hover { background:#FAFBFC; }
.pdb-row-ico { width:38px; height:38px; border-radius:12px; background:#FFF7ED; color:#E8780F; display:grid; place-items:center; font-size:17px; flex-shrink:0; }
.pdb-row-ico.navy { background:#EEF2FF; color:#0F1F5C; }
.pdb-row-ico.gray { background:#F2F4F6; color:#6B7280; }
.pdb-row-body { flex:1; min-width:0; }
.pdb-row-title { font-size:13.5px; font-weight:700; color:#191F28; letter-spacing:-0.02em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pdb-row-meta { margin-top:2px; font-size:11.5px; color:#8B95A1; font-weight:500; letter-spacing:-0.02em; }
.pdb-row-val { font-size:14px; font-weight:800; color:#191F28; letter-spacing:-0.02em; text-align:right; }
.pdb-row-val.orange { color:#E8780F; }
.pdb-row-val.navy { color:#0F1F5C; }
.pdb-row-status { font-size:10.5px; font-weight:800; padding:4px 9px; border-radius:6px; letter-spacing:-0.02em; }
.pdb-row-status.done { background:#E8FBF1; color:#0FA864; }
.pdb-row-status.wait { background:#FFF4D5; color:#A88300; }
.pdb-row-status.ship { background:#E1F0FF; color:#1B64DA; }
.pdb-row-status.warn { background:#FFEBEB; color:#D93A3A; }
/* 정산 상세 카드 */
.pdb-settle-card { background:#fff; border:1px solid #F2F4F6; border-radius:18px; padding:20px 22px; margin-bottom:14px; }
.pdb-settle-card .pdb-list-title { margin-bottom:14px; }
.pdb-settle-rows { display:flex; flex-direction:column; gap:0; }
.pdb-settle-line { display:flex; justify-content:space-between; align-items:center; padding:11px 0; font-size:13.5px; border-bottom:1px solid #F8F9FA; }
.pdb-settle-line:last-child { border-bottom:none; padding-top:14px; font-size:14.5px; }
.pdb-settle-line .label { color:#8B95A1; font-weight:600; letter-spacing:-0.02em; }
.pdb-settle-line .val { color:#191F28; font-weight:800; letter-spacing:-0.02em; }
.pdb-settle-line.total .label { color:#191F28; font-weight:800; }
.pdb-settle-line.total .val { color:#E8780F; font-weight:900; font-size:18px; }
/* 공지 */
.pdb-notice { padding:14px 20px; border-top:1px solid #F2F4F6; }
.pdb-notice:first-of-type { border-top:none; }
.pdb-notice-top { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.pdb-notice-tag { font-size:10.5px; font-weight:800; color:#E8780F; background:#FFF7ED; padding:2px 7px; border-radius:5px; letter-spacing:-0.02em; }
.pdb-notice-date { font-size:11px; color:#8B95A1; font-weight:600; letter-spacing:-0.02em; }
.pdb-notice-msg { font-size:13px; font-weight:600; color:#191F28; letter-spacing:-0.02em; line-height:1.5; }
@media (max-width:700px) {
  .pdb { padding:24px 16px 60px; }
  .pdb-hello-text { font-size:19px; }
  .pdb-hero { padding:22px 20px; border-radius:16px; }
  .pdb-hero-num { font-size:30px; }
  .pdb-hero-num .unit { font-size:17px; }
  .pdb-quick-btn { padding:14px 6px; }
  .pdb-quick-ico { font-size:20px; }
  .pdb-quick-name { font-size:11px; }
  .pdb-list-head { padding:16px 18px 12px; }
  .pdb-list-title { font-size:14px; }
  .pdb-row { padding:12px 18px; gap:10px; }
  .pdb-row-ico { width:34px; height:34px; font-size:15px; }
  .pdb-row-title { font-size:13px; }
  .pdb-row-meta { font-size:11px; }
  .pdb-row-val { font-size:13px; }
  .pdb-settle-card { padding:18px 18px; }
  .pdb-settle-line.total .val { font-size:16px; }
}
</style>
<div class="pdb-wrap">
  <!-- 인사 -->
  <div class="pdb-hello">
    <div>
      <div class="pdb-hello-text">○○대리점 사장님,<br/>오늘도 <b>좋은 하루</b> 되세요 👋</div>
      <div class="pdb-hello-sub">새 주문 3건 · 배송 대기 2건이 있어요</div>
    </div>
    <span class="pdb-tier">🥇 GOLD 등급</span>
  </div>
  <!-- 메인 매출 hero -->
  <div class="pdb-hero">
    <div class="pdb-hero-label">이번달 매출이에요</div>
    <div class="pdb-hero-num">12,840,000<span class="unit">원</span></div>
    <div class="pdb-hero-meta">
      <span class="pdb-hero-delta">↑ 전월보다 +18%</span>
      <span class="pdb-hero-date">5월 1일 ~ 오늘</span>
    </div>
  </div>
  <!-- 미니 KPI -->
  <div class="pdb-minis">
    <div class="pdb-mini"><div class="pdb-mini-num navy">38<span class="unit">건</span></div><div class="pdb-mini-label">이번달 발주</div></div>
    <div class="pdb-mini"><div class="pdb-mini-num orange">2.8<span class="unit">M원</span></div><div class="pdb-mini-label">정산 예정</div></div>
    <div class="pdb-mini"><div class="pdb-mini-num">3<span class="unit">건</span></div><div class="pdb-mini-label">처리 대기</div></div>
  </div>
  <!-- 메인 CTA -->
  <button class="pdb-cta" type="button">🛒 새 발주하기 <span class="pdb-cta-arrow">→</span></button>
  <!-- 빠른 액션 -->
  <div class="pdb-quick">
    <a class="pdb-quick-btn" href="#"><span class="pdb-quick-ico">📊</span><span class="pdb-quick-name">정산 내역</span></a>
    <a class="pdb-quick-btn" href="#"><span class="pdb-quick-ico">📦</span><span class="pdb-quick-name">재고 확인</span></a>
    <a class="pdb-quick-btn" href="#"><span class="pdb-quick-ico">📑</span><span class="pdb-quick-name">발주 이력</span></a>
    <a class="pdb-quick-btn" href="#"><span class="pdb-quick-ico">💬</span><span class="pdb-quick-name">본사 문의</span></a>
  </div>
  <!-- 정산 상세 -->
  <div class="pdb-settle-card">
    <div class="pdb-list-title">💳 다음 정산 안내</div>
    <div class="pdb-settle-rows">
      <div class="pdb-settle-line"><span class="label">이번달 매출 합계</span><span class="val">12,840,000원</span></div>
      <div class="pdb-settle-line"><span class="label">대리점 마진 (22%)</span><span class="val">2,824,800원</span></div>
      <div class="pdb-settle-line"><span class="label">PG 수수료</span><span class="val" style="color:#8B95A1;">-128,400원</span></div>
      <div class="pdb-settle-line total"><span class="label">5월 31일 입금 예정</span><span class="val">2,696,400원</span></div>
    </div>
  </div>
  <!-- 최근 발주 -->
  <div class="pdb-list">
    <div class="pdb-list-head">
      <div class="pdb-list-title">📦 최근 발주</div>
      <a class="pdb-list-more" href="#">전체 →</a>
    </div>
    <div class="pdb-row">
      <div class="pdb-row-ico">💧</div>
      <div class="pdb-row-body">
        <div class="pdb-row-title">옥상 방수 패키지 × 5</div>
        <div class="pdb-row-meta">05/14 14:22 · 배송완료</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
        <span class="pdb-row-status done">완료</span>
        <span class="pdb-row-val orange">389,500원</span>
      </div>
    </div>
    <div class="pdb-row">
      <div class="pdb-row-ico navy">🎨</div>
      <div class="pdb-row-body">
        <div class="pdb-row-title">단열 페인트 × 12</div>
        <div class="pdb-row-meta">05/15 09:08 · CJ대한통운</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
        <span class="pdb-row-status ship">배송중</span>
        <span class="pdb-row-val">236,400원</span>
      </div>
    </div>
    <div class="pdb-row">
      <div class="pdb-row-ico gray">🛠</div>
      <div class="pdb-row-body">
        <div class="pdb-row-title">탈락 방지 키트 × 3</div>
        <div class="pdb-row-meta">05/16 11:35</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
        <span class="pdb-row-status wait">발주 준비</span>
        <span class="pdb-row-val">68,400원</span>
      </div>
    </div>
    <div class="pdb-row">
      <div class="pdb-row-ico" style="background:#FFEBEB; color:#D93A3A;">⚡</div>
      <div class="pdb-row-body">
        <div class="pdb-row-title">균열 보수 시트 × 8</div>
        <div class="pdb-row-meta">05/16 16:12 · 결제 대기중</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
        <span class="pdb-row-status warn">결제 대기</span>
        <span class="pdb-row-val">152,000원</span>
      </div>
    </div>
  </div>
  <!-- 공지 -->
  <div class="pdb-list">
    <div class="pdb-list-head">
      <div class="pdb-list-title">📢 본사 공지</div>
      <a class="pdb-list-more" href="#">전체 →</a>
    </div>
    <div class="pdb-notice">
      <div class="pdb-notice-top"><span class="pdb-notice-tag">정산</span><span class="pdb-notice-date">2일 전</span></div>
      <div class="pdb-notice-msg">5월 정산 마감일 안내 — 매월 말일 17시 기준 집계, 익월 5일 입금</div>
    </div>
    <div class="pdb-notice">
      <div class="pdb-notice-top"><span class="pdb-notice-tag">신상품</span><span class="pdb-notice-date">6일 전</span></div>
      <div class="pdb-notice-msg">POUR 슈퍼복합압축시트 v3 출시 — Gold 등급 12% 추가 할인</div>
    </div>
    <div class="pdb-notice">
      <div class="pdb-notice-top"><span class="pdb-notice-tag">등급</span><span class="pdb-notice-date">2주 전</span></div>
      <div class="pdb-notice-msg">Q2 등급 산정 결과 — ○○대리점 Silver → Gold 승급 🎉</div>
    </div>
  </div>
</div>
</section>`;


  const SEED_AI_RECOMMEND_HTML = `
<style>
.par * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Noto Sans KR', sans-serif; }
.par { --po:#F97316; --po-d:#EA580C; --po-l:#FFEDD5; --po-glow:rgba(249,115,22,.35); --pn:#0F1F5C; --bg:#FFFBF5; --card:#FFFFFF; --txt:#1F2937; --txt-d:#6B7280; --bd:#E5E7EB; --bd-h:#FED7AA; }

/* ====== 메인 트리거: 채팅 스타일 ====== */
.par-trigger { position:relative; max-width:1080px; margin:0 auto; padding:48px 22px; background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 50%,#FFFBF5 100%); border-radius:24px; overflow:hidden; }
.par-trigger::before { content:''; position:absolute; inset:0; background-image: radial-gradient(circle at 20% 10%,rgba(249,115,22,.06) 0%,transparent 40%),radial-gradient(circle at 80% 90%,rgba(15,31,92,.04) 0%,transparent 40%); pointer-events:none; }
.par-trigger-inner { position:relative; z-index:1; text-align:center; max-width:640px; margin:0 auto; }
.par-core-mini { width:64px; height:64px; margin:0 auto 14px; position:relative; display:grid; place-items:center; }
.par-core-mini .ring { position:absolute; inset:0; border:2px solid var(--po); border-radius:50%; animation:par-spin 14s linear infinite; opacity:.4; }
.par-core-mini .ring2 { position:absolute; inset:6px; border:1px dashed var(--po-d); border-radius:50%; animation:par-spin 9s linear infinite reverse; opacity:.5; }
.par-core-mini .center { width:46px; height:46px; background:linear-gradient(135deg,var(--po),var(--po-d)); border-radius:50%; display:grid; place-items:center; font-size:24px; box-shadow:0 6px 16px var(--po-glow); position:relative; z-index:2; }
@keyframes par-spin { to { transform:rotate(360deg); } }
.par-trigger-kicker { display:inline-flex; align-items:center; gap:8px; padding:5px 14px; background:var(--po-l); border:1px solid var(--bd-h); border-radius:999px; font-size:11px; font-weight:800; color:var(--po-d); margin-bottom:12px; }
.par-trigger-kicker .ld { width:6px; height:6px; background:var(--po); border-radius:50%; box-shadow:0 0 6px var(--po); animation:par-blink 1.4s ease-in-out infinite; }
@keyframes par-blink { 50%{opacity:.3;} }
.par-trigger h2 { font-size:24px; font-weight:900; margin:0 0 6px; letter-spacing:-.5px; color:var(--pn); line-height:1.35; }
.par-trigger h2 .accent { color:var(--po); }
.par-trigger p { font-size:13px; color:var(--txt-d); line-height:1.55; margin-bottom:22px; }

/* 채팅 입력바 */
.par-chat-wrap { position:relative; margin-bottom:16px; }
.par-chat-input { display:flex; align-items:center; gap:6px; padding:6px 8px 6px 14px; background:#fff; border:2px solid var(--bd); border-radius:16px; box-shadow:0 4px 18px rgba(15,31,92,.08); transition:border-color .2s, box-shadow .2s; }
.par-chat-input:focus-within { border-color:var(--po); box-shadow:0 4px 22px rgba(249,115,22,.18); }
.par-chat-input .par-chat-attach { width:42px; height:42px; flex-shrink:0; display:grid; place-items:center; background:transparent; border:0; cursor:pointer; font-size:22px; color:var(--po-d); border-radius:10px; transition:background .15s; }
.par-chat-input .par-chat-attach:hover { background:var(--po-l); }
.par-suggest { position:absolute; top:calc(100% + 6px); left:0; right:0; background:#fff; border:1px solid var(--bd); border-radius:14px; box-shadow:0 12px 36px rgba(15,31,92,.18); z-index:50; overflow:hidden; max-height:60vh; overflow-y:auto; display:none; text-align:left; }
.par-suggest.open { display:block; }
.par-suggest .sg-head { padding:10px 14px 4px; font-size:11px; font-weight:800; color:var(--txt-d); letter-spacing:.5px; }
.par-suggest .sg-cat { padding:7px 14px; font-size:11px; font-weight:800; color:var(--po-d); background:var(--po-l); border-top:1px solid var(--bd); display:flex; align-items:center; gap:7px; letter-spacing:.3px; }
.par-suggest .sg-cat .sg-cnt { background:#fff; color:var(--po-d); padding:1px 7px; border-radius:999px; font-size:10px; font-weight:800; }
.par-suggest .item { display:flex; gap:10px; padding:8px 14px; cursor:pointer; border-top:1px solid var(--bd); transition:background .12s; align-items:center; }
.par-suggest .item:hover { background:var(--po-l); }
.par-suggest .item .img { width:42px; height:42px; border-radius:7px; flex-shrink:0; background:#F3F4F6 center/cover no-repeat; }
.par-suggest .item .info { flex:1; min-width:0; }
.par-suggest .item .title { font-size:13px; font-weight:800; color:var(--pn); margin-bottom:3px; }
.par-suggest .item .title b { color:var(--po-d); }
.par-suggest .item .desc { font-size:11.5px; color:var(--txt-d); line-height:1.45; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.par-suggest .item .arr { color:var(--po); font-size:18px; flex-shrink:0; }
.par-suggest .empty { padding:18px; text-align:center; font-size:12.5px; color:var(--txt-d); }
.par-chat-input input { flex:1; padding:12px 6px; border:0; outline:0; font-size:14.5px; color:var(--txt); background:transparent; min-width:0; }
.par-chat-input input::placeholder { color:var(--txt-d); }
.par-chat-input .par-chat-send { width:42px; height:42px; flex-shrink:0; background:linear-gradient(135deg,var(--po),var(--po-d)); border:0; border-radius:12px; cursor:pointer; color:#fff; font-size:20px; font-weight:900; box-shadow:0 4px 12px var(--po-glow); transition:transform .1s; display:grid; place-items:center; }
.par-chat-input .par-chat-send:hover { transform:translateY(-1px); }
.par-chat-input .par-chat-send:disabled { opacity:.4; cursor:not-allowed; transform:none; box-shadow:none; }

/* 빠른 질문 칩 */
.par-chips { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-bottom:18px; align-items:center; }
.par-chips .lbl { font-size:11px; color:var(--txt-d); font-weight:700; margin-right:4px; }
.par-chip { padding:7px 13px; background:#fff; border:1.5px solid var(--bd); border-radius:999px; color:var(--pn); font-size:12.5px; font-weight:600; cursor:pointer; transition:all .15s; }
.par-chip:hover { border-color:var(--po); background:var(--po-l); color:var(--po-d); }
.par-chip.more { color:var(--po-d); border-color:var(--bd-h); background:var(--po-l); }

.par-trust { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
.par-trust .item { display:inline-flex; align-items:center; gap:5px; padding:5px 11px; background:#fff; border:1px solid var(--bd); border-radius:999px; font-size:11.5px; font-weight:700; color:var(--pn); }
.par-trust .item .v { color:var(--po-d); font-weight:900; }

@media (max-width:640px) { .par-trigger { padding:36px 16px; border-radius:18px; } .par-trigger h2 { font-size:21px; } .par-chat-input input { font-size:14px; } }

/* ====== 모달 ====== */
.par-modal-mask { position:fixed; inset:0; background:rgba(15,31,92,.55); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); z-index:9999; opacity:0; pointer-events:none; transition:opacity .25s ease; }
.par-modal-mask.open { opacity:1; pointer-events:auto; }
.par-modal { position:fixed; left:0; right:0; bottom:0; max-height:92vh; background:#FFFBF5; border-radius:24px 24px 0 0; box-shadow:0 -8px 40px rgba(15,31,92,.25); z-index:10000; transform:translateY(100%); transition:transform .35s cubic-bezier(.4,0,.2,1); display:flex; flex-direction:column; }
.par-modal.open { transform:translateY(0); }
.par-modal-handle { width:48px; height:5px; background:#D1D5DB; border-radius:3px; margin:10px auto 0; flex-shrink:0; }
.par-modal-head { padding:14px 20px; display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--bd); flex-shrink:0; background:#fff; }
.par-modal-head .av { width:32px; height:32px; background:linear-gradient(135deg,var(--po),var(--po-d)); border-radius:50%; display:grid; place-items:center; font-size:16px; flex-shrink:0; }
.par-modal-head .ttl { font-size:15px; font-weight:800; color:var(--pn); flex:1; }
.par-modal-head .ttl .sub { display:block; font-size:11px; font-weight:600; color:var(--txt-d); margin-top:2px; }
.par-modal-head .close { width:34px; height:34px; background:#F3F4F6; border:0; border-radius:50%; cursor:pointer; font-size:16px; color:var(--txt-d); display:grid; place-items:center; flex-shrink:0; }
.par-modal-head .close:hover { background:#E5E7EB; }
.par-modal-body { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:18px 18px 30px; background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 30%,#FFFBF5 100%); }

.par-stepper { display:flex; gap:5px; justify-content:center; margin-bottom:24px; flex-wrap:wrap; align-items:center; }
.par-stepper .stp { display:inline-flex; align-items:center; gap:7px; padding:8px 13px; border:1px solid var(--bd); border-radius:999px; font-size:12px; font-weight:700; color:var(--txt-d); background:#fff; transition:all .25s; }
.par-stepper .stp .num { font-size:10px; padding:2px 7px; background:#F3F4F6; border-radius:5px; }
.par-stepper .stp.active { color:#fff; border-color:var(--po); background:var(--po); box-shadow:0 4px 14px var(--po-glow); }
.par-stepper .stp.active .num { background:rgba(255,255,255,.25); color:#fff; }
.par-stepper .stp.done { color:var(--po-d); border-color:var(--bd-h); background:var(--po-l); }
.par-stepper .stp.done .num { background:#fff; color:var(--po-d); }
.par-stepper .ar { color:var(--txt-d); font-size:11px; }
.par-screen { display:none; }
.par-screen.active { display:block; animation:par-fade .3s ease; }
@keyframes par-fade { from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:none;} }
.par-block { background:var(--card); border:1px solid var(--bd); border-radius:16px; padding:22px; margin-bottom:14px; box-shadow:0 2px 8px rgba(0,0,0,.04); }
.par-block-h { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:1px dashed var(--bd); }
.par-block-h .seq { font-size:11px; color:var(--po-d); font-weight:800; padding:4px 10px; background:var(--po-l); border-radius:5px; }
.par-block-h .ttl { font-size:13.5px; font-weight:800; color:var(--pn); }
.par-h { font-size:17px; font-weight:800; color:var(--pn); margin-bottom:6px; text-align:center; line-height:1.4; }
.par-sub { font-size:13px; color:var(--txt-d); margin-bottom:18px; text-align:center; line-height:1.6; }
.par-entry { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.par-entry-card { padding:32px 22px; background:var(--card); border:2px solid var(--bd); border-radius:16px; cursor:pointer; transition:all .25s; text-align:center; }
.par-entry-card:hover { border-color:var(--po); transform:translateY(-4px); box-shadow:0 12px 28px rgba(249,115,22,.18); }
.par-entry-card .ic { font-size:44px; margin-bottom:10px; display:block; }
.par-entry-card .t { font-size:16px; font-weight:800; color:var(--pn); margin-bottom:5px; }
.par-entry-card .d { font-size:12.5px; color:var(--txt-d); line-height:1.6; }
.par-entry-card .b { display:inline-block; margin-top:14px; padding:5px 12px; background:#F3F4F6; color:var(--txt-d); font-size:11px; font-weight:800; border-radius:6px; }
.par-entry-card.recommend { border-color:var(--po); background:linear-gradient(135deg,#FFF7ED,#FFEDD5); }
.par-entry-card.recommend .b { background:var(--po); color:#fff; box-shadow:0 4px 10px var(--po-glow); }
.par-upload { border:2px dashed var(--bd-h); border-radius:14px; padding:36px 22px; text-align:center; background:var(--po-l); transition:all .2s; cursor:pointer; margin-bottom:14px; }
.par-upload:hover, .par-upload.drag { border-color:var(--po); background:#FFE4C4; }
.par-upload .ic { font-size:44px; margin-bottom:10px; display:block; }
.par-upload .t { font-size:14.5px; font-weight:800; color:var(--pn); margin-bottom:4px; }
.par-upload .d { font-size:12.5px; color:var(--txt-d); }
.par-upload-actions { display:flex; gap:10px; justify-content:center; margin-top:14px; flex-wrap:wrap; }
.par-upload-actions .btn { padding:10px 18px; background:#fff; border:1.5px solid var(--po); border-radius:10px; color:var(--po-d); font-size:12.5px; font-weight:800; cursor:pointer; }
.par-upload-actions .btn:hover { background:var(--po); color:#fff; }
.par-thumbs { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; margin-bottom:14px; }
.par-thumb { position:relative; aspect-ratio:1/1; border-radius:10px; overflow:hidden; border:1px solid var(--bd); background:#F3F4F6; }
.par-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.par-thumb .num { position:absolute; top:6px; left:6px; padding:2px 7px; background:var(--po); color:#fff; font-size:10px; font-weight:800; border-radius:4px; }
.par-thumb .rm { position:absolute; top:5px; right:5px; width:24px; height:24px; background:rgba(220,38,38,.95); color:#fff; border:0; border-radius:50%; cursor:pointer; font-size:13px; font-weight:900; }
.par-thumb-add { aspect-ratio:1/1; border:2px dashed var(--bd); border-radius:10px; background:#fff; cursor:pointer; display:grid; place-items:center; color:var(--txt-d); font-size:28px; }
.par-thumb-add:hover { border-color:var(--po); color:var(--po); background:var(--po-l); }
.par-thumb-info { font-size:12px; color:var(--txt-d); text-align:center; margin-bottom:14px; }
.par-analyzing { text-align:center; padding:60px 20px; }
.par-spinner { width:64px; height:64px; border:4px solid var(--po-l); border-top-color:var(--po); border-radius:50%; animation:par-spin 1s linear infinite; margin:0 auto 22px; }
.par-analyzing .t { font-size:18px; color:var(--pn); font-weight:800; margin-bottom:14px; }
.par-analyzing .l { display:block; font-size:13px; color:var(--txt-d); margin:6px 0; }
.par-analyzing .l.ok { color:var(--po-d); font-weight:700; }
.par-analyzing .l.cur { color:var(--po); font-weight:700; }
.par-conf { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border:1px solid var(--bd-h); border-radius:10px; margin-bottom:14px; }
.par-conf .lbl { font-size:12px; font-weight:800; color:var(--po-d); }
.par-conf .val { font-size:24px; font-weight:900; color:var(--po-d); }
.par-conf .val .pct { font-size:14px; }
.par-detect { display:grid; gap:9px; margin-bottom:14px; }
.par-detect .row { display:flex; align-items:center; gap:10px; padding:12px 14px; background:#F9FAFB; border:1px solid var(--bd); border-radius:10px; }
.par-detect .row .lbl { font-size:11px; color:var(--txt-d); font-weight:700; min-width:78px; }
.par-detect .row .val { flex:1; font-size:14px; color:var(--pn); font-weight:800; }
.par-detect .row .badge { padding:3px 9px; background:var(--po-l); color:var(--po-d); font-size:10px; font-weight:800; border-radius:5px; }
.par-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; margin-bottom:14px; }
.par-card { padding:18px 16px; background:var(--card); border:2px solid var(--bd); border-radius:12px; cursor:pointer; transition:all .2s; text-align:left; }
.par-card:hover { border-color:var(--po); background:#FFFBF5; transform:translateY(-2px); box-shadow:0 8px 18px rgba(249,115,22,.12); }
.par-card .ic { font-size:28px; margin-bottom:8px; display:block; }
.par-card .ttl { font-size:13.5px; font-weight:800; color:var(--pn); margin-bottom:3px; }
.par-card .desc { font-size:11.5px; color:var(--txt-d); line-height:1.5; }
.par-symptoms { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
.par-sym { padding:8px 14px; background:#fff; border:1.5px solid var(--bd); border-radius:999px; color:var(--txt); font-size:13px; font-weight:600; cursor:pointer; }
.par-sym:hover { border-color:var(--po); color:var(--po-d); }
.par-sym.on { background:var(--po); border-color:var(--po); color:#fff; box-shadow:0 4px 10px var(--po-glow); }
.par-free { width:100%; padding:13px 15px; background:#fff; border:1.5px solid var(--bd); border-radius:10px; color:var(--txt); font-size:13.5px; outline:none; resize:vertical; min-height:84px; line-height:1.65; }
.par-free::placeholder { color:var(--txt-d); }
.par-free:focus { border-color:var(--po); box-shadow:0 0 0 3px var(--po-l); }
.par-cta-row { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; align-items:center; }
.par-cta { padding:14px 24px; background:linear-gradient(135deg,var(--po),var(--po-d)); border:0; border-radius:12px; color:#fff; font-size:14px; font-weight:800; cursor:pointer; box-shadow:0 6px 18px var(--po-glow); display:inline-flex; align-items:center; gap:8px; }
.par-cta:hover { transform:translateY(-1px); }
.par-cta:disabled { opacity:.4; cursor:not-allowed; transform:none; box-shadow:none; }
.par-cta-ghost { padding:14px 22px; background:#fff; border:1.5px solid var(--bd); border-radius:12px; color:var(--txt-d); font-size:13px; font-weight:700; cursor:pointer; }
.par-cta-ghost:hover { color:var(--po-d); border-color:var(--po); }
.par-back { display:inline-flex; align-items:center; gap:5px; padding:7px 13px; background:#fff; border:1px solid var(--bd); border-radius:8px; color:var(--txt-d); font-size:12px; font-weight:700; cursor:pointer; margin-bottom:14px; }
.par-back:hover { border-color:var(--po); color:var(--po-d); }
.par-diag-h { font-size:19px; font-weight:900; color:var(--pn); margin-bottom:14px; line-height:1.45; }
.par-diag-h .accent { color:var(--po-d); }
.par-points { list-style:none; padding:0; margin:0 0 14px; counter-reset:par-cnt; }
.par-points li { position:relative; padding:11px 12px 11px 42px; font-size:13.5px; line-height:1.7; color:var(--txt); border-bottom:1px solid var(--bd); }
.par-points li:last-child { border-bottom:0; }
.par-points li::before { content:counter(par-cnt,decimal-leading-zero); counter-increment:par-cnt; position:absolute; left:8px; top:11px; font-size:10px; color:#fff; background:var(--po); border-radius:5px; padding:3px 7px; font-weight:800; }
.par-points li b { color:var(--po-d); font-weight:800; }
.par-method { background:linear-gradient(135deg,#FFF7ED,#FFFFFF); border:2px solid var(--bd-h); border-radius:14px; padding:24px; margin-bottom:14px; box-shadow:0 4px 16px rgba(249,115,22,.08); }
.par-method .code { font-size:11px; color:var(--po-d); font-weight:800; margin-bottom:6px; padding:3px 10px; background:#fff; border-radius:5px; display:inline-block; border:1px solid var(--bd-h); }
.par-method h3 { font-size:23px; font-weight:900; color:var(--pn); margin:0 0 10px; line-height:1.3; }
.par-method .summ { font-size:14px; line-height:1.7; color:var(--txt); margin-bottom:16px; }
.par-method .principles { display:grid; gap:8px; }
.par-method .principles .pr { padding:11px 13px; background:#fff; border:1px solid var(--bd); border-radius:9px; font-size:13px; line-height:1.55; color:var(--txt); display:flex; align-items:flex-start; gap:9px; }
.par-method .principles .pr .dot { flex-shrink:0; width:8px; height:8px; background:var(--po); border-radius:50%; margin-top:5px; }
.par-evidence { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:9px; margin-top:16px; }
.par-ev { background:#fff; border:1px solid var(--bd); border-radius:9px; padding:11px 13px; }
.par-ev .lbl { font-size:10px; color:var(--txt-d); font-weight:700; margin-bottom:4px; }
.par-ev .val { font-size:20px; color:var(--po-d); font-weight:900; line-height:1.1; }
.par-ev .val .unit { font-size:11px; color:var(--txt-d); margin-left:2px; font-weight:600; }
.par-ev .src { font-size:10px; color:var(--txt-d); margin-top:3px; font-weight:600; }
.par-products-h { font-size:14px; font-weight:800; color:var(--pn); margin:18px 0 12px; padding-left:4px; display:flex; align-items:center; gap:8px; }
.par-products-h::before { content:''; width:5px; height:16px; background:var(--po); border-radius:3px; }
.par-products { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:11px; margin-bottom:14px; }
.par-pcard { background:#fff; border:1px solid var(--bd); border-radius:12px; overflow:hidden; cursor:pointer; transition:all .2s; text-decoration:none; color:inherit; display:block; }
.par-pcard:hover { border-color:var(--po); transform:translateY(-3px); box-shadow:0 10px 22px rgba(249,115,22,.15); }
.par-pcard .img { aspect-ratio:1/1; background:#F3F4F6 center/cover no-repeat; position:relative; }
.par-pcard .role { position:absolute; top:8px; left:8px; padding:3px 8px; background:var(--po); color:#fff; font-size:10px; font-weight:800; border-radius:4px; }
.par-pcard .ext { position:absolute; bottom:8px; right:8px; padding:3px 7px; background:rgba(15,31,92,.85); color:#fff; font-size:10px; font-weight:800; border-radius:4px; }
.par-pcard .body { padding:11px 13px 13px; }
.par-pcard .name { font-size:13px; font-weight:700; color:var(--pn); line-height:1.4; margin-bottom:5px; }
.par-pcard .price { font-size:18px; color:var(--po-d); font-weight:900; }
.par-pcard .price .won { font-size:12px; color:var(--txt-d); margin-left:2px; font-weight:600; }
.par-pkg { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border:1.5px solid var(--po); border-radius:18px; padding:22px 22px 20px; margin:18px 0 14px; position:relative; box-shadow:0 12px 30px rgba(249,115,22,.18); }
.par-pkg .badge { display:inline-block; padding:5px 12px; background:linear-gradient(135deg,var(--po),var(--po-d)); color:#fff; font-size:11px; font-weight:900; border-radius:6px; letter-spacing:.5px; margin-bottom:12px; box-shadow:0 4px 10px rgba(249,115,22,.4); }
.par-pkg .pkg-name { font-size:19px; font-weight:900; color:var(--pn); letter-spacing:-.4px; margin-bottom:10px; line-height:1.3; }
.par-pkg .pkg-meta { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
.par-pkg .pkg-meta span { padding:4px 10px; background:#fff; border:1px solid #FED7AA; color:var(--po-d); font-size:11px; font-weight:800; border-radius:6px; }
.par-pkg .pkg-meta .self.ok { background:#ECFDF5; border-color:#A7F3D0; color:#059669; }
.par-pkg .pkg-meta .self.warn { background:#FEF3C7; border-color:#FCD34D; color:#B45309; }
.par-pkg .pkg-meta .self.pro { background:#FEE2E2; border-color:#FCA5A5; color:#DC2626; }
.par-pkg .pkg-compose { background:rgba(255,255,255,.65); border-radius:10px; padding:11px 14px; font-size:12px; color:var(--txt-d); font-weight:700; line-height:1.65; margin-bottom:14px; }
.par-pkg .pkg-compose b { color:var(--pn); font-weight:900; margin-right:4px; }
.par-pkg .pkg-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.par-pkg .pkg-price { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.par-pkg .pkg-price .orig { font-size:13px; color:var(--txt-d); text-decoration:line-through; font-weight:600; }
.par-pkg .pkg-price .now { font-family:'Bebas Neue',sans-serif; font-size:30px; font-weight:900; color:var(--po-d); letter-spacing:.5px; line-height:1; }
.par-pkg .pkg-price .won { font-size:13px; color:var(--txt-d); font-weight:700; }
.par-pkg .pkg-price .save { padding:3px 9px; background:#DC2626; color:#fff; font-size:10.5px; font-weight:900; border-radius:5px; letter-spacing:.3px; }
.par-pkg .pkg-buy { padding:10px 18px; background:var(--pn); color:#fff; border-radius:10px; font-size:13px; font-weight:900; text-decoration:none; transition:transform .2s; white-space:nowrap; }
.par-pkg .pkg-buy:hover { transform:translateY(-2px); background:var(--po-d); }
.par-final-cta { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px; }
.par-final-cta .big { padding:18px; background:linear-gradient(135deg,var(--po),var(--po-d)); border:0; border-radius:12px; color:#fff; font-size:14px; font-weight:800; text-align:center; box-shadow:0 6px 18px var(--po-glow); text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.par-final-cta .alt { padding:18px; background:#fff; border:2px solid var(--pn); border-radius:12px; color:var(--pn); font-size:14px; font-weight:800; text-align:center; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.par-final-cta .alt:hover { background:var(--pn); color:#fff; }
.par-final-note { font-size:11.5px; color:var(--txt-d); text-align:center; margin-top:10px; font-weight:700; line-height:1.55; }
.par-final-note b { color:var(--pn); font-weight:900; }
.par-storage-note { padding:12px 14px; background:var(--po-l); border-left:3px solid var(--po); border-radius:0 8px 8px 0; font-size:12px; color:var(--txt); margin-top:14px; line-height:1.6; }
.par-storage-note b { color:var(--po-d); }
@media (max-width:720px) { .par-stepper .stp{font-size:11px; padding:7px 10px;} .par-stepper .ar{display:none;} .par-entry{grid-template-columns:1fr;} .par-final-cta{grid-template-columns:1fr;} .par-products{grid-template-columns:repeat(2,1fr);} .par-method h3{font-size:19px;} .par-modal{max-height:96vh;} .par-pkg .pkg-name{font-size:17px;} .par-pkg .pkg-price .now{font-size:24px;} }
</style>

<section class="par">
  <div class="par-trigger">
    <div class="par-trigger-inner">
      <div class="par-core-mini"><div class="ring"></div><div class="ring2"></div><div class="center">🧭</div></div>
      <span class="par-trigger-kicker"><span class="ld"></span>POUR 길잡이 · AI 건물 진단</span>
      <h2>건물 어디가 아프세요? <span class="accent">길잡이가 답해드려요</span></h2>
      <p>사진 한 장 또는 한 줄이면 충분해요</p>

      <div class="par-chat-wrap">
        <div class="par-chat-input">
          <button class="par-chat-attach" id="par-chat-attach" title="사진 첨부 또는 촬영">📷</button>
          <input type="text" id="par-chat-text" placeholder="예: 옥상에서 물이 새요" autocomplete="off" />
          <button class="par-chat-send" id="par-chat-send" disabled aria-label="보내기">→</button>
        </div>
        <div class="par-suggest" id="par-suggest"></div>
      </div>

      <div class="par-chips">
        <span class="lbl">자주 묻는 고민</span>
        <button class="par-chip" data-prof="2">옥상 슬라브 누수</button>
        <button class="par-chip" data-prof="1">슁글 지붕</button>
        <button class="par-chip" data-prof="6">창틀 누수</button>
        <button class="par-chip" data-prof="5">외벽 균열</button>
        <button class="par-chip" data-prof="8">지하 곰팡이</button>
        <button class="par-chip more" id="par-chip-more">더보기 ▸</button>
      </div>

      <div class="par-trust">
        <span class="item"><span class="v">260만</span> 세대 검증</span>
        <span class="item"><span class="v">250+</span> 파트너사</span>
        <span class="item"><span class="v">70+</span> 특허·인증</span>
      </div>

      <input type="file" id="par-trigger-file" accept="image/*" multiple hidden />
    </div>
  </div>

  <div class="par-modal-mask" id="par-modal-mask">
    <div class="par-modal" id="par-modal">
      <div class="par-modal-handle"></div>
      <div class="par-modal-head">
        <div class="av">🧭</div>
        <div class="ttl">POUR 길잡이<span class="sub">AI 건물 진단</span></div>
        <button class="close" id="par-close-modal" aria-label="닫기">✕</button>
      </div>
      <div class="par-modal-body">
        <div class="par-stepper">
          <div class="stp" data-stp="1"><span class="num">01</span> 어디가?</div>
          <span class="ar">▸</span>
          <div class="stp" data-stp="2"><span class="num">02</span> 어떤 증상?</div>
          <span class="ar">▸</span>
          <div class="stp" data-stp="3"><span class="num">03</span> 길잡이 진단</div>
          <span class="ar">▸</span>
          <div class="stp" data-stp="4"><span class="num">04</span> 추천 자재</div>
        </div>
        <div class="par-screen" data-screen="entry">
          <div class="par-h">어떻게 도와드릴까요?</div>
          <div class="par-sub">직접 알려주거나, 사진 한 장 보여주시면 길잡이가 살펴봐드릴게요</div>
          <div class="par-entry">
            <div class="par-entry-card" data-go="manual1"><span class="ic">📋</span><div class="t">직접 알려주기</div><div class="d">건물·부위·증상을<br/>3단계로 천천히 선택</div><span class="b">차근차근 3단계</span></div>
            <div class="par-entry-card recommend" data-go="photo"><span class="ic">📷</span><div class="t">사진 한 장이면 끝</div><div class="d">길잡이가 보고<br/>부위·증상을 자동 진단</div><span class="b">⭐ 추천</span></div>
          </div>
        </div>
        <div class="par-screen" data-screen="photo">
          <button class="par-back" data-back="entry">◂ 처음으로</button>
          <div class="par-block">
            <div class="par-block-h"><span class="seq">사진 첨부</span><span class="ttl">하자 사진을 보여주세요</span></div>
            <div class="par-upload" id="par-upload-zone">
              <span class="ic">📷</span>
              <div class="t">사진을 끌어다 놓거나 선택해 주세요</div>
              <div class="d">최대 5장 · JPG·PNG · 1장당 10MB 이하</div>
              <div class="par-upload-actions">
                <button class="btn" id="par-pick-gallery">🖼 갤러리에서 선택</button>
                <button class="btn" id="par-pick-camera">📸 사진 촬영</button>
              </div>
              <input type="file" id="par-file-gallery" accept="image/*" multiple hidden />
              <input type="file" id="par-file-camera" accept="image/*" capture="environment" hidden />
            </div>
            <div class="par-thumbs" id="par-thumbs"></div>
            <div class="par-thumb-info" id="par-thumb-info" style="display:none;"></div>
            <div class="par-cta-row">
              <button class="par-cta" id="par-analyze-btn" disabled>길잡이에게 보여주기 →</button>
              <button class="par-cta-ghost" data-back="entry">취소</button>
            </div>
            <div class="par-storage-note">🔒 보내주신 사진은 <b>POUR스토어 서버에 안전하게 보관</b>되며, 진단 정확도를 높이는 데에만 사용됩니다.</div>
          </div>
        </div>
        <div class="par-screen" data-screen="analyzing">
          <div class="par-analyzing">
            <div class="par-spinner"></div>
            <div class="t">길잡이가 살펴보는 중이에요</div>
            <span class="l ok" id="ana-l1">✓ 사진 잘 받았어요</span>
            <span class="l cur" id="ana-l2">→ 어떤 건물인지 확인 중...</span>
            <span class="l" id="ana-l3" style="display:none;">→ 어디가 문제인지 보는 중...</span>
            <span class="l" id="ana-l4" style="display:none;">→ 증상을 살펴보는 중...</span>
            <span class="l" id="ana-l5" style="display:none;">→ 비슷한 시공 사례 찾는 중...</span>
          </div>
        </div>
        <div class="par-screen" data-screen="photo-result">
          <button class="par-back" data-back="photo">◂ 사진 다시 올리기</button>
          <div class="par-block">
            <div class="par-block-h"><span class="seq">살펴본 결과</span><span class="ttl">길잡이가 본 결과예요</span></div>
            <div class="par-conf"><span class="lbl">▸ 정확도</span><span class="val"><span id="par-conf-val">—</span><span class="pct"> %</span></span></div>
            <div class="par-detect">
              <div class="row"><span class="lbl">어떤 건물</span><span class="val" id="par-d-bld">—</span><span class="badge">확인됨</span></div>
              <div class="row"><span class="lbl">어디가 문제</span><span class="val" id="par-d-sur">—</span><span class="badge">확인됨</span></div>
              <div class="row"><span class="lbl">어떤 증상</span><span class="val" id="par-d-sym">—</span><span class="badge">확인됨</span></div>
            </div>
            <div class="par-cta-row">
              <button class="par-cta" id="par-confirm-go">맞아요, 진단 보기 →</button>
              <button class="par-cta-ghost" data-back="manual1">✏ 다시 알려줄게요</button>
            </div>
          </div>
        </div>
        <div class="par-screen" data-screen="manual1">
          <button class="par-back" data-back="entry">◂ 처음으로</button>
          <div class="par-block">
            <div class="par-block-h"><span class="seq">1 / 3</span><span class="ttl">어떤 건물이세요?</span></div>
            <div class="par-cards" id="par-bld-cards"></div>
          </div>
        </div>
        <div class="par-screen" data-screen="manual2">
          <button class="par-back" data-back="manual1">◂ 건물 다시</button>
          <div class="par-block">
            <div class="par-block-h"><span class="seq">2 / 3</span><span class="ttl">어디가 문제인가요?</span></div>
            <div class="par-cards" id="par-sur-cards"></div>
          </div>
        </div>
        <div class="par-screen" data-screen="manual3">
          <button class="par-back" data-back="manual2">◂ 부위 다시</button>
          <div class="par-block">
            <div class="par-block-h"><span class="seq">3 / 3</span><span class="ttl">어떤 증상이 있나요?</span></div>
            <div class="par-sub" style="text-align:left; margin-bottom:14px;">해당하는 항목을 모두 골라주세요 (여러 개 선택 가능)</div>
            <div class="par-symptoms" id="par-sym-list"></div>
            <div class="par-h" style="text-align:left; margin-bottom:6px; margin-top:18px; font-size:14px;">하실 말씀 있으세요? <span style="font-weight:500; font-size:11.5px; color:var(--txt-d);">(선택)</span></div>
            <textarea class="par-free" id="par-free-memo" placeholder="예: 작년 여름부터 증상 시작, 베란다 쪽이 특히 심해요"></textarea>
            <div class="par-cta-row">
              <button class="par-cta" id="par-go-diag">길잡이 진단 보기 →</button>
            </div>
          </div>
        </div>
        <div class="par-screen" data-screen="diagnosis">
          <button class="par-back" id="par-back-diag">◂ 입력 다시</button>
          <div class="par-block">
            <div class="par-block-h"><span class="seq">길잡이 진단</span><span class="ttl">왜 이런 일이 생긴 걸까요?</span></div>
            <div class="par-diag-h" id="par-diag-h"></div>
            <ol class="par-points" id="par-diag-points"></ol>
          </div>
          <div class="par-cta-row">
            <button class="par-cta" id="par-go-sol">이렇게 해결하세요 →</button>
          </div>
        </div>
        <div class="par-screen" data-screen="solution">
          <button class="par-back" data-back="diagnosis">◂ 진단으로</button>
          <div class="par-method">
            <div class="code" id="par-sol-code"></div>
            <h3 id="par-sol-name"></h3>
            <div class="summ" id="par-sol-summary"></div>
            <div class="principles" id="par-sol-principles"></div>
            <div class="par-evidence" id="par-sol-evidence"></div>
          </div>
          <div id="par-sol-products-wrap"></div>
          <div class="par-final-cta">
            <a class="big" id="par-buy-package" href="#" target="_blank" rel="noopener">🛒 풀패키지 구매하기</a>
            <a class="alt" id="par-consult" href="#" target="_blank" rel="noopener">💬 시공 매칭 신청</a>
          </div>
          <div class="par-final-note" id="par-final-note"></div>
          <div class="par-cta-row" style="margin-top:18px;">
            <button class="par-cta-ghost" id="par-restart">↻ 다른 고민 물어보기</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
<script>
(function(){
var BLDS=[{id:'apt',ic:'🏢',name:'아파트 (고층)',desc:'8층 이상 공동주택, 고층 빌라'},{id:'low',ic:'🏠',name:'단독·저층 주택',desc:'단독, 다가구, 저층 빌라'},{id:'comm',ic:'🏬',name:'상가·오피스텔',desc:'근린상가, 오피스, 학원'},{id:'fact',ic:'🏭',name:'공장·창고',desc:'공장 지붕, 창고, 물류센터'},{id:'gov',ic:'🏛',name:'관공서·학교',desc:'관공서, 학교, 공공시설'}];
var SURFS=[{id:'roof-slab',ic:'🏢',name:'옥상 슬라브',desc:'콘크리트 평지붕'},{id:'roof-shingle',ic:'🏠',name:'아스팔트 슁글 지붕',desc:'경사형 — 미국식 마감재'},{id:'roof-metal',ic:'⛩️',name:'금속기와 지붕',desc:'경사형 금속기와 — 맞물림형'},{id:'roof-color-steel',ic:'🔶',name:'칼라강판·징크판넬',desc:'금속 외장 — 색상 열화·녹·부식'},{id:'drain',ic:'💧',name:'옥상 배수구',desc:'드레인, 빗물받이'},{id:'wall',ic:'🧱',name:'외벽',desc:'균열, 도장, 백화'},{id:'window',ic:'🪟',name:'창틀·창호 이음부',desc:'실리콘 노후·후레싱·창틀 누수'},{id:'parking',ic:'🅿️',name:'지하 주차장',desc:'바닥, 벽체, 천장'},{id:'balcony',ic:'🏡',name:'발코니·베란다',desc:'바닥, 벽, 배수'},{id:'road',ic:'🛣️',name:'단지내 도로',desc:'주차장, 도로 균열·포트홀'},{id:'underg',ic:'🕳️',name:'지하실·수조',desc:'배면 누수, 곰팡이'},{id:'etc',ic:'📐',name:'기타',desc:'분류가 어려운 경우'}];
var SYMPS=['누수','균열','박리','부식','강풍 탈락','마모','미끄럼','곰팡이','백화','단차'];
var PROFILES=[
{keys:{surf:['drain']},qText:'배수구 쪽에서 물이 새서 누수가 생겼어요.',diagH:'배수구 부식 — <span class="accent">물이 자주 닿아서</span> 생긴 문제예요',diagPoints:['배수구는 비·눈·결로 등 <b>물이 가장 자주 닿는</b> 곳이에요.','오랫동안 물에 노출되면 콘크리트와 금속이 <b>녹슬고 약해집니다</b>.','배수가 막히면 고인 물이 <b>슬라브 균열을 더 빨리 만들어요</b>.','결국 배수구 → 슬라브 균열 → 천장 누수까지 진행돼요.'],sol:{code:'METHOD-149',name:'옥상배관방수트랩 공법',summary:'배수구를 일체화 방수트랩으로 바꿔서 부식과 누수를 한 번에 해결합니다.',principles:['배수구 주변 콘크리트와 트랩을 한 덩어리로 시공','특수 방수재로 이음부를 완전히 막음','배수 효율은 그대로, 부식만 차단','시공 후 정기 점검 가이드 함께 제공'],evidence:[{lbl:'시방서',val:'No.149',src:'POUR솔루션'},{lbl:'시공 사례',val:'700+',unit:'단지',src:'전국'}],products:[{role:'CORE',name:'POUR 방수트랩 일체형',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=DRAIN',url:'https://www.pourstore.net/product/drain-trap'},{role:'BOND',name:'POUR하이퍼티',price:'68,000',img:'https://placehold.co/300x300/F97316/fff?text=HYPER',url:'https://www.pourstore.net/product/hyper-t'},{role:'FINISH',name:'POUR코트재 마감',price:'95,000',img:'https://placehold.co/300x300/F97316/fff?text=COAT',url:'https://www.pourstore.net/product/coat'}],packageUrl:'https://www.pourstore.net/category/drain-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['roof-shingle']},qText:'아스팔트 슁글 지붕에서 슁글이 자꾸 떨어져요.',diagH:'슁글의 본래 용도 — <span class="accent">미국 저층 목조주택</span>용이었어요',diagPoints:['아스팔트 슁글은 원래 <b>미국 저층 목조주택의 미관용</b> 마감재예요.','국내 고층 아파트에 쓰면 <b>강풍에 쉽게 떨어져요</b>.','풍속 30m/s 이상이면 떨어지기 시작 → 추락·누수 위험이 같이 와요.','단순 재부착이 아니라 <b>건물과 한 덩어리로 만드는 방식</b>이 필요해요.'],sol:{code:'METHOD-128',name:'복합시트방수공법',summary:'시트와 도료로 슁글·슬라브를 완전히 일체화시켜 떨어지는 것을 막고 방수까지 같이 해결합니다.',principles:['슁글 위에 POUR슈퍼복합압축시트 부착','도료로 시트·슁글·슬라브를 한 덩어리로','POUR HOOKER 특허로 후레싱 단단히 고정','6단계 방수 공정'],evidence:[{lbl:'인장강도',val:'11.4',unit:'N/mm²',src:'KTR · 타사 10배'},{lbl:'시방서',val:'No.128',src:'POUR솔루션'}],products:[{role:'CORE',name:'POUR슈퍼복합압축시트',price:'450,000',img:'https://placehold.co/300x300/F97316/fff?text=SHEET',url:'https://www.pourstore.net/product/composite-sheet'},{role:'BOND',name:'POUR코트재',price:'280,000',img:'https://placehold.co/300x300/F97316/fff?text=COAT',url:'https://www.pourstore.net/product/coat'},{role:'FIX',name:'POUR HOOKER',price:'120,000',img:'https://placehold.co/300x300/F97316/fff?text=HOOKER',url:'https://www.pourstore.net/product/hooker'}],packageUrl:'https://www.pourstore.net/category/shingle-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['roof-slab']},qText:'옥상 슬라브에서 물이 새고 콘크리트에 잔금이 많아요.',diagH:'슬라브 노후화 — <span class="accent">콘크리트가 늙어가는 중</span>이에요',diagPoints:['시간이 지나면 콘크리트가 <b>공기와 반응해 약해져요</b>.','안에 있는 철근이 녹슬며 <b>균열·박리</b>가 빨라집니다.','단순 도장만으로는 1~2년 안에 다시 똑같이 됩니다.','<b>바탕면 강화 + 듀얼 방수 + 환기 처리</b>가 함께 필요해요.'],sol:{code:'METHOD-132',name:'슬라브 듀얼강화방수공법',summary:'바탕면 강화부터 듀얼복합시트, 페이퍼팬벤트 환기, 코트재 마감까지 6가지를 한 번에 처리합니다.',principles:['POUR모체강화함침 — 늙은 콘크리트 강화','듀얼복합시트 + 슈퍼복합압축시트 이중 방수','POUR페이퍼팬벤트로 내부 습기 자연 배출','POUR코트재 마감 — 일사반사율 91.8%'],evidence:[{lbl:'인장강도',val:'5.8',unit:'N/mm²',src:'KTR · KS 4배'},{lbl:'중성화',val:'0.3',unit:'mm',src:'KTR'}],products:[{role:'BASE',name:'POUR모체강화함침',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=BASE',url:'https://www.pourstore.net/product/base'},{role:'CORE',name:'듀얼복합시트',price:'520,000',img:'https://placehold.co/300x300/F97316/fff?text=DUAL',url:'https://www.pourstore.net/product/dual-sheet'},{role:'VENT',name:'POUR페이퍼팬벤트',price:'95,000',img:'https://placehold.co/300x300/F97316/fff?text=VENT',url:'https://www.pourstore.net/product/vent'}],packageUrl:'https://www.pourstore.net/category/slab-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['roof-metal']},qText:'금속기와가 부식되고 맞물림이 풀려 떨어질 것 같아요.',diagH:'금속기와 노후화 — <span class="accent">맞물림 풀림</span>은 추락 사고로 이어집니다',diagPoints:['금속기와는 시간이 지나면 <b>맞물림이 풀리고 부식이 가속</b>됩니다.','강판 추락은 인명 사고로 직결됩니다.','강풍 + 빗물 침투로 누수도 동반 발생합니다.','<b>일체화 시공 + 후레싱 보강</b>이 핵심입니다.'],sol:{code:'METHOD-130',name:'금속기와 방수 + 코팅공법',summary:'바탕면과 방수층을 완전 일체화하고 POUR HOOKER로 후레싱을 견고히 보강합니다. 5차 방수 공정으로 부식과 누수를 동시에 차단해요.',principles:['바탕면과 방수층 완전 일체화','POUR HOOKER 특허 후레싱 보강','5차 방수 공정 — 함침부터 상도까지','일사반사율 91.8% — 차열 효과 동반'],evidence:[{lbl:'일사반사율',val:'91.8',unit:'%',src:'KCL'},{lbl:'시방서',val:'No.130',src:'POUR솔루션'}],products:[{role:'CORE',name:'금속기와 일체화 시트',price:'420,000',img:'https://placehold.co/300x300/F97316/fff?text=METAL',url:'https://www.pourstore.net/product/metal-tile-sheet'},{role:'FIX',name:'POUR HOOKER',price:'120,000',img:'https://placehold.co/300x300/F97316/fff?text=HOOKER',url:'https://www.pourstore.net/product/hooker'},{role:'TOP',name:'금속기와 코팅재',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=COAT',url:'https://www.pourstore.net/product/metal-coat'}],packageUrl:'https://www.pourstore.net/category/metal-tile-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['roof-color-steel']},qText:'칼라강판·징크판넬이 색이 바래고 부식이 생겼어요.',diagH:'칼라강판·징크 노후 — <span class="accent">색상 열화·녹·부식</span>으로 미관과 강도가 떨어져요',diagPoints:['시간이 지나면 <b>색상이 바래고 녹</b>이 생기며 미관이 나빠져요.','코팅이 벗겨지면 비·결로 침투로 <b>강판 자체 부식</b>이 진행됩니다.','부식이 심해지면 <b>이음부 누수와 추락 위험</b>이 같이 와요.','<b>고성능 코팅재로 표면 재시공</b>이 필요해요.'],sol:{code:'METHOD-138',name:'금속기와·칼라강판 코팅공법',summary:'POUR코트재로 부식 방지 + 차열 + 미관 회복을 한 번에 처리합니다. KTR/KCL 공인 인장강도 5.8 N/mm²(KS 4배), 일사반사율 91.8%로 검증됐어요.',principles:['표면 클리닝 + 녹 제거','POUR 프라이머로 부착력 강화','POUR코트재 본도장 — 인장강도 5.8 N/mm²','일사반사율 91.8% 마감 — 차열·미관 동시'],evidence:[{lbl:'인장강도',val:'5.8',unit:'N/mm²',src:'KTR · KS 4배'},{lbl:'일사반사율',val:'91.8',unit:'%',src:'KCL'},{lbl:'시방서',val:'No.138',src:'POUR솔루션'}],products:[{role:'PRIME',name:'POUR 금속용 프라이머',price:'160,000',img:'https://placehold.co/300x300/F97316/fff?text=PRIMER',url:'https://www.pourstore.net/product/metal-primer'},{role:'CORE',name:'POUR코트재 (KS 4배)',price:'280,000',img:'https://placehold.co/300x300/F97316/fff?text=COAT',url:'https://www.pourstore.net/product/coat'},{role:'TOP',name:'POUR 차열 상도',price:'140,000',img:'https://placehold.co/300x300/F97316/fff?text=TOP',url:'https://www.pourstore.net/product/topcoat'}],packageUrl:'https://www.pourstore.net/category/color-steel-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['wall']},qText:'외벽에 균열이 생겨 도색을 다시 해야 할 것 같아요.',diagH:'외벽 균열 — <span class="accent">단순 도색은 1~2년이면 또 갈라져요</span>',diagPoints:['온도 차이로 콘크리트가 <b>늘어났다 줄었다</b>를 반복하며 미세 균열이 생겨요.','미세 균열로 빗물이 들어가면 → 철근이 녹슬고 → 도장이 떨어집니다.','단순 재도색은 표면만 가리는 거라 곧 다시 갈라져요.','균열 보수 + 탄성 도료 + 차열 처리가 함께 필요해요.'],sol:{code:'METHOD-139',name:'바인더+플러스 (고급형) 재도장',summary:'POUR하이퍼티로 균열을 봉합한 후 플러스 코트로 탄성·차열을 강화합니다.',principles:['POUR하이퍼티 — 600% 늘어나는 퍼티','플러스 코트로 탄성·차열·중성화 방지','중성화 깊이 0.0mm','아파트·관공서 대형 현장 권장'],evidence:[{lbl:'신장률',val:'519',unit:'%',src:'KTR · 5배'},{lbl:'중성화',val:'0.0',unit:'mm',src:'KTR'}],products:[{role:'CORE',name:'POUR하이퍼티',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=HYPER',url:'https://www.pourstore.net/product/hyper-t'},{role:'COAT',name:'POUR 플러스 코트',price:'320,000',img:'https://placehold.co/300x300/F97316/fff?text=PLUS',url:'https://www.pourstore.net/product/plus'},{role:'BIND',name:'POUR 바인더',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=BINDER',url:'https://www.pourstore.net/product/binder'}],packageUrl:'https://www.pourstore.net/category/wall-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['window']},qText:'창틀 주변에서 비 오면 물이 스며들어요.',diagH:'창틀 이음부 — <span class="accent">실리콘 노후·후레싱 틈</span>이 원인이에요',diagPoints:['창틀과 외벽이 만나는 <b>이음부 실리콘이 시간이 지나면 갈라져요</b>.','이음부 틈으로 빗물이 들어가 <b>실내 누수·곰팡이</b>가 생깁니다.','후레싱(창호 주변 마감재)이 들떠 있으면 누수가 더 심해져요.','단순 실리콘 재시공만으론 부족 — <b>이음부 보수 + 후레싱 일체화</b>가 필요해요.'],sol:{code:'METHOD-148',name:'후커보강·이음부 봉합공법',summary:'창틀 주변 후레싱을 POUR HOOKER로 견고히 고정하고, 이음부에 POUR하이퍼티로 신축 봉합을 합니다. 빗물 침투를 원천 차단해요.',principles:['손상된 미장 마감면도 시공 가능 (저비용 고효율)','POUR HOOKER 특허로 후레싱 일체화','POUR하이퍼티 — 신장률 608%로 신축 봉합','시공 후 정기 점검 가이드 제공'],evidence:[{lbl:'신장률',val:'608',unit:'%',src:'SGS · KS 2배'},{lbl:'시방서',val:'No.148',src:'POUR솔루션'}],products:[{role:'CORE',name:'POUR하이퍼티 (608% 신장)',price:'68,000',img:'https://placehold.co/300x300/F97316/fff?text=HYPER',url:'https://www.pourstore.net/product/hyper-t'},{role:'FIX',name:'POUR HOOKER (특허)',price:'120,000',img:'https://placehold.co/300x300/F97316/fff?text=HOOKER',url:'https://www.pourstore.net/product/hooker'},{role:'TOP',name:'POUR 실리콘 보수재',price:'45,000',img:'https://placehold.co/300x300/F97316/fff?text=SILICON',url:'https://www.pourstore.net/product/silicone'}],packageUrl:'https://www.pourstore.net/category/window-frame-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['parking']},qText:'지하주차장 바닥이 갈라지고 페인트가 벗겨져요.',diagH:'에폭시 도장 노후 — <span class="accent">차량 하중과 결로</span>가 원인이에요',diagPoints:['차량이 반복해 다니며 도장면이 <b>마모돼요</b>.','결로·습기가 들어가면 바탕면이 <b>박리</b>됩니다.','소음·미세분진이 발생하고 미관도 나빠져요.','<b>마모에 강하고 미끄럽지 않은</b> 도장이 필요해요.'],sol:{code:'METHOD-125',name:'에폭시 + 엠보라이닝 도장',summary:'압축강도 85.9N/mm²의 고강도 에폭시 + 엠보라이닝.',principles:['바탕면 면처리 + 프라이머','에폭시 본도장 — 압축강도 85.9N/mm²','엠보라이닝 — 미끄럼 방지','내마모성 76mg'],evidence:[{lbl:'압축강도',val:'85.9',unit:'N/mm²',src:'KTR'},{lbl:'부착강도',val:'2.3',unit:'MPa',src:'KTR'},{lbl:'내마모',val:'76',unit:'mg',src:'KTR'}],products:[{role:'PRIME',name:'POUR 에폭시 프라이머',price:'140,000',img:'https://placehold.co/300x300/F97316/fff?text=PRIMER',url:'https://www.pourstore.net/product/epoxy-primer'},{role:'CORE',name:'POUR 에폭시 본도장',price:'380,000',img:'https://placehold.co/300x300/F97316/fff?text=EPOXY',url:'https://www.pourstore.net/product/epoxy'},{role:'TOP',name:'엠보라이닝 코트',price:'220,000',img:'https://placehold.co/300x300/F97316/fff?text=EMBO',url:'https://www.pourstore.net/product/embo'}],packageUrl:'https://www.pourstore.net/category/parking-package',consultUrl:'https://www.poursolution.net/168'}},
{keys:{surf:['underg']},qText:'지하실 벽에서 물이 스며 나오고 곰팡이가 생겨요.',diagH:'지하 배면 누수 — <span class="accent">표면 처리만으로는 못 막아요</span>',diagPoints:['지하는 흙과 지하수가 콘크리트 <b>뒷면에서 밀려옵니다</b>.','내부 표면 도장은 곧 부풀어 떨어집니다.','아크릴 방수재를 <b>초고압으로 주입</b>해 새 방수층을 만들어야 해요.','국토교통부 지정 건설신기술로 검증된 방법이에요.'],sol:{code:'METHOD-137',name:'아크릴배면차수공법',summary:'2액형 아크릴 방수재를 초고압으로 콘크리트 배면에 주입해 새 방수층을 만듭니다.',principles:['구조물 외부에서 직접 닿지 않아도 가능','초고압 주입으로 균열·공극까지 채움','국토교통부 건설신기술 1026호','지하주차장·수조·정수장 적용'],evidence:[{lbl:'건설신기술',val:'1026',unit:'호',src:'국토교통부'}],products:[{role:'CORE',name:'2액형 아크릴 방수재',price:'380,000',img:'https://placehold.co/300x300/F97316/fff?text=ACRYLIC',url:'https://www.pourstore.net/product/acrylic'},{role:'EQUIP',name:'초고압 주입 시공',price:'견적',img:'https://placehold.co/300x300/F97316/fff?text=PUMP',url:'https://www.poursolution.net/137'}],packageUrl:'https://www.pourstore.net/category/underground-package',consultUrl:'https://www.poursolution.net/168'}},
{keys:{surf:['road']},qText:'단지 내 도로 아스팔트가 갈라지고 구멍이 생겼어요.',diagH:'아스팔트 노후 — <span class="accent">층 사이가 분리</span>되었어요',diagPoints:['시간이 지나면 아스팔트는 <b>유연성을 잃고 갈라져요</b>.','균열로 빗물이 들어가면 <b>포트홀</b>로 발전합니다.','단순 메우기는 6개월 안에 똑같이 됩니다.','<b>POUR아스콘 + 균열보수</b> 통합 시공이 필요해요.'],sol:{code:'METHOD-167',name:'POUR아스콘 도로포장공법',summary:'아스팔트 균열 보수와 도로포장을 한 번에 처리합니다.',principles:['균열 부위 절단 후 청소','POUR 아스콘 채움재로 균열 봉합','신규 아스팔트 포장','단지내 도로·주차장 적용'],evidence:[{lbl:'시방서',val:'No.167',src:'POUR솔루션'}],products:[{role:'PATCH',name:'POUR 아스팔트균열보수재',price:'120,000',img:'https://placehold.co/300x300/F97316/fff?text=PATCH',url:'https://www.pourstore.net/product/asphalt-patch'},{role:'CORE',name:'POUR 아스콘',price:'견적',img:'https://placehold.co/300x300/F97316/fff?text=ASCON',url:'https://www.poursolution.net/167'}],packageUrl:'https://www.pourstore.net/category/road-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{},qText:'건물에 노후 문제가 있어요. 진단을 받아보고 싶어요.',diagH:'노후 콘크리트 — <span class="accent">중성화·균열</span>이 진행 중이에요',diagPoints:['대부분의 건물 노후 문제는 <b>콘크리트 중성화</b>에서 시작돼요.','중성화 → 미세 균열 → 빗물 침투 → 철근 부식.','표면 처리만으로는 근본 해결이 어려워요.','<b>모체 강화 + 균열 보수 + 마감 보호</b> 3단계가 필요해요.'],sol:{code:'POUR 종합진단',name:'맞춤 진단 + 패키지 추천',summary:'전문가가 직접 방문해서 분석하고 맞춤 패키지를 제안드려요.',principles:['현장 방문 진단 (무료)','시공 데이터 기반 맞춤 패키지','700+ 단지 시공 사례 참고','시공 후 사후 관리 가이드'],evidence:[{lbl:'누적 시공',val:'2.6M',unit:'세대',src:'전국'},{lbl:'특허·인증',val:'70+',unit:'건',src:'KTR/KCL'}],products:[{role:'CORE',name:'POUR하이퍼티',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=HYPER',url:'https://www.pourstore.net/product/hyper-t'},{role:'COAT',name:'POUR코트재',price:'95,000',img:'https://placehold.co/300x300/F97316/fff?text=COAT',url:'https://www.pourstore.net/product/coat'}],packageUrl:'https://www.pourstore.net/category/general',consultUrl:'https://www.poursolution.net/163'}}
];
var KEYWORDS={drain:['배수','드레인','하수구','빗물받이','배수구','누수','새요','물샘'],'roof-slab':['옥상','슬라브','평지붕','콘크리트','잔금','누수','균열','새요'],'roof-shingle':['옥상','지붕','슁글','쉬글','아스팔트','경사','목조','떨어','탈락','누수'],'roof-metal':['옥상','지붕','금속기와','기와','맞물림','부식','누수'],'roof-color-steel':['옥상','지붕','칼라강판','강판','징크','징크판넬','판넬','색바램','녹','부식','누수'],wall:['외벽','벽','균열','크랙','도색','도장','백화','재도장','누수'],window:['창틀','창호','창문','샷시','새시','실리콘','후레싱','창','이음부','누수','곰팡이','결로'],parking:['주차','지하주차','바닥','에폭시','박리','누수'],underg:['지하실','지하','곰팡이','배면','수조','스며','누수'],road:['도로','아스팔트','포트홀','단지','구멍','갈라'],balcony:['발코니','베란다','누수','곰팡이']};
var SUGGESTIONS=[
{profIdx:0,cat:'🏠 지붕·옥상',title:'옥상 배수구 누수',desc:'배수구 부식·정체수',kw:['옥상','배수','드레인','하수','빗물','빗물받이','배수구','물샘','새요','누수'],img:'https://placehold.co/120x120/F97316/fff?text=DRAIN'},
{profIdx:2,cat:'🏠 지붕·옥상',title:'옥상 슬라브 누수',desc:'콘크리트 평지붕',kw:['옥상','슬라브','평지붕','콘크리트','잔금','누수','크랙','균열','갈라'],img:'https://placehold.co/120x120/F97316/fff?text=SLAB'},
{profIdx:1,cat:'🏠 지붕·옥상',title:'아스팔트 슁글 지붕',desc:'경사형 — 강풍 탈락',kw:['옥상','지붕','슁글','쉬글','아스팔트','경사','떨어','탈락','강풍','날아','목조','누수'],img:'https://placehold.co/120x120/EA580C/fff?text=SHINGLE'},
{profIdx:3,cat:'🏠 지붕·옥상',title:'금속기와 지붕',desc:'경사형 — 맞물림 풀림',kw:['옥상','지붕','금속기와','기와','맞물림','부식','떨어','누수'],img:'https://placehold.co/120x120/EA580C/fff?text=METAL+TILE'},
{profIdx:4,cat:'🏠 지붕·옥상',title:'칼라강판·징크판넬',desc:'금속 외장 — 색상 열화·녹',kw:['옥상','지붕','외장','칼라강판','강판','징크','징크판넬','판넬','색바램','녹','부식','코팅','누수'],img:'https://placehold.co/120x120/EA580C/fff?text=COLOR+STEEL'},
{profIdx:5,cat:'🧱 외벽·창호',title:'외벽 균열·재도장',desc:'미세 균열·박리·백화',kw:['외벽','벽','균열','크랙','도색','도장','백화','재도장','박리','누수'],img:'https://placehold.co/120x120/F97316/fff?text=WALL'},
{profIdx:6,cat:'🧱 외벽·창호',title:'창틀·창호 누수',desc:'실리콘 노후·후레싱',kw:['창틀','창호','창문','샷시','새시','실리콘','후레싱','창','이음부','누수','곰팡이','결로'],img:'https://placehold.co/120x120/F97316/fff?text=WINDOW'},
{profIdx:7,cat:'🅿 지하·주차장',title:'지하주차장 바닥',desc:'에폭시 노후·마모',kw:['주차','지하주차','바닥','에폭시','박리','마모','벗겨','누수'],img:'https://placehold.co/120x120/F97316/fff?text=PARKING'},
{profIdx:8,cat:'🅿 지하·주차장',title:'지하실·수조 누수',desc:'배면 침투수·곰팡이',kw:['지하','지하실','곰팡이','배면','수조','스며','곰팽이','누수'],img:'https://placehold.co/120x120/EA580C/fff?text=BASEMENT'},
{profIdx:9,cat:'🛣 외부·도로',title:'단지 도로·아스팔트',desc:'균열·포트홀',kw:['도로','아스팔트','포트홀','단지','구멍','갈라'],img:'https://placehold.co/120x120/F97316/fff?text=ROAD'},
{profIdx:10,cat:'📐 그 외',title:'종합 진단',desc:'전문가 방문·맞춤 패키지',kw:[],img:'https://placehold.co/120x120/9CA3AF/fff?text=GENERAL'}
];
function getSuggestions(q){q=(q||'').trim().toLowerCase();if(!q)return [];var hit=[];SUGGESTIONS.forEach(function(s){var titleHit=s.title.toLowerCase().indexOf(q)!==-1;var kwHit=s.kw.some(function(k){return k.indexOf(q)!==-1||q.indexOf(k)!==-1;});if(titleHit||kwHit)hit.push(s);});return hit.slice(0,8);}
function highlightTerm(text,q){if(!q||!text)return text;var i=text.toLowerCase().indexOf(q.toLowerCase());if(i<0)return text;return text.slice(0,i)+'<b>'+text.slice(i,i+q.length)+'</b>'+text.slice(i+q.length);}
var state={screen:'entry',photos:[],detected:null,choice:{bld:null,surf:null,syms:[],memo:''}};
var root=document.querySelector('.par');
var modalMask=root.querySelector('#par-modal-mask'),modal=root.querySelector('#par-modal');
function openModal(){modalMask.classList.add('open');setTimeout(function(){modal.classList.add('open');},10);document.body.style.overflow='hidden';}
function closeModal(){modal.classList.remove('open');setTimeout(function(){modalMask.classList.remove('open');document.body.style.overflow='';},300);}
root.querySelector('#par-close-modal').addEventListener('click',closeModal);
modalMask.addEventListener('click',function(e){if(e.target===modalMask)closeModal();});
function show(name){state.screen=name;root.querySelectorAll('.par-screen').forEach(function(s){s.classList.toggle('active',s.dataset.screen===name);});var stepIdx=({entry:1,photo:2,analyzing:2,'photo-result':2,manual1:2,manual2:2,manual3:2,diagnosis:3,solution:4})[name]||1;root.querySelectorAll('.par-stepper .stp').forEach(function(el,i){el.classList.remove('active','done');if(i+1<stepIdx)el.classList.add('done');else if(i+1===stepIdx)el.classList.add('active');});var body=root.querySelector('.par-modal-body');if(body)body.scrollTop=0;}
root.querySelectorAll('[data-go]').forEach(function(el){el.addEventListener('click',function(){show(el.dataset.go);});});
root.querySelectorAll('[data-back]').forEach(function(el){el.addEventListener('click',function(){show(el.dataset.back);});});

/* ---- 채팅 입력 ---- */
var chatText=root.querySelector('#par-chat-text'),chatSend=root.querySelector('#par-chat-send'),chatAttach=root.querySelector('#par-chat-attach'),triggerFile=root.querySelector('#par-trigger-file');
var suggestEl=root.querySelector('#par-suggest');
function renderSuggest(){var q=chatText.value.trim();if(!q){closeSuggest();return;}var items=getSuggestions(q);if(!items.length){suggestEl.innerHTML='<div class="empty">관련된 고민이 없어요. 그래도 보내시면 길잡이가 직접 안내해드릴게요.</div>';suggestEl.classList.add('open');return;}var groups={},order=[];items.forEach(function(s){var c=s.cat||'📐 그 외';if(!groups[c]){groups[c]=[];order.push(c);}groups[c].push(s);});var html='<div class="sg-head">▸ 관련 하자 ('+items.length+'건) — 본인 건물 유형 선택</div>';order.forEach(function(c){var grp=groups[c];html+='<div class="sg-cat">'+c+' <span class="sg-cnt">'+grp.length+'</span></div>';grp.forEach(function(s){html+='<div class="item" data-prof="'+s.profIdx+'"><div class="img" style="background-image:url(\\''+s.img+'\\')"></div><div class="info"><div class="title">'+highlightTerm(s.title,q)+'</div><div class="desc">'+s.desc+'</div></div><span class="arr">→</span></div>';});});suggestEl.innerHTML=html;suggestEl.querySelectorAll('.item').forEach(function(it){it.addEventListener('mousedown',function(e){e.preventDefault();var idx=parseInt(it.dataset.prof,10);var profile=PROFILES[idx];if(!profile)return;state.profile=profile;state.choice.memo=chatText.value.trim();runDiagnosis(profile);openModal();closeSuggest();chatText.value='';chatSend.disabled=true;});});suggestEl.classList.add('open');}
function closeSuggest(){suggestEl.classList.remove('open');}
chatText.addEventListener('input',function(){chatSend.disabled=!chatText.value.trim();renderSuggest();});
chatText.addEventListener('focus',function(){if(chatText.value.trim())renderSuggest();});
chatText.addEventListener('blur',function(){setTimeout(closeSuggest,200);});
chatText.addEventListener('keydown',function(e){if(e.key==='Enter'&&!chatSend.disabled){handleChatSend();closeSuggest();}else if(e.key==='Escape'){closeSuggest();}});
chatSend.addEventListener('click',handleChatSend);
function handleChatSend(){var t=chatText.value.trim();if(!t)return;var profile=matchByKeywords(t);if(profile){state.profile=profile;state.choice.memo=t;runDiagnosis(profile);openModal();}else{state.choice.memo=t;openModal();show('manual1');}chatText.value='';chatSend.disabled=true;}
function matchByKeywords(text){for(var i=0;i<PROFILES.length;i++){var p=PROFILES[i];if(!p.keys||!p.keys.surf)continue;var surfId=p.keys.surf[0];var kws=KEYWORDS[surfId]||[];for(var j=0;j<kws.length;j++){if(text.indexOf(kws[j])!==-1)return p;}}return null;}

/* 빠른 칩 */
root.querySelectorAll('.par-chip[data-prof]').forEach(function(c){c.addEventListener('click',function(){var idx=parseInt(c.dataset.prof,10);var p=PROFILES[idx];if(!p)return;state.profile=p;state.choice.memo=c.textContent.trim();runDiagnosis(p);openModal();});});
root.querySelector('#par-chip-more').addEventListener('click',function(){openModal();show('entry');});

/* 사진 첨부 (트리거에서) */
chatAttach.addEventListener('click',function(){triggerFile.click();});
triggerFile.addEventListener('change',function(e){var files=e.target.files;if(files&&files.length){addPhotos(files);openModal();show('photo');}e.target.value='';});

/* ---- 모달 안 사진 업로드 ---- */
var uploadZone=root.querySelector('#par-upload-zone'),galleryInput=root.querySelector('#par-file-gallery'),cameraInput=root.querySelector('#par-file-camera'),thumbsEl=root.querySelector('#par-thumbs'),thumbInfo=root.querySelector('#par-thumb-info'),analyzeBtn=root.querySelector('#par-analyze-btn');
root.querySelector('#par-pick-gallery').addEventListener('click',function(e){e.stopPropagation();galleryInput.click();});
root.querySelector('#par-pick-camera').addEventListener('click',function(e){e.stopPropagation();cameraInput.click();});
uploadZone.addEventListener('click',function(e){if(e.target.closest('button'))return;galleryInput.click();});
galleryInput.addEventListener('change',function(e){addPhotos(e.target.files);e.target.value='';});
cameraInput.addEventListener('change',function(e){addPhotos(e.target.files);e.target.value='';});
['dragenter','dragover'].forEach(function(ev){uploadZone.addEventListener(ev,function(e){e.preventDefault();uploadZone.classList.add('drag');});});
['dragleave','drop'].forEach(function(ev){uploadZone.addEventListener(ev,function(e){e.preventDefault();uploadZone.classList.remove('drag');});});
uploadZone.addEventListener('drop',function(e){if(e.dataTransfer.files)addPhotos(e.dataTransfer.files);});
function addPhotos(files){Array.from(files).forEach(function(f){if(state.photos.length>=5)return;if(!/^image\\//.test(f.type))return;if(f.size>10*1024*1024)return;state.photos.push({name:f.name,size:f.size,url:URL.createObjectURL(f)});});renderThumbs();}
function renderThumbs(){thumbsEl.innerHTML='';state.photos.forEach(function(p,i){var t=document.createElement('div');t.className='par-thumb';t.innerHTML='<img src="'+p.url+'" alt=""/><span class="num">0'+(i+1)+'</span><button class="rm" data-i="'+i+'">×</button>';thumbsEl.appendChild(t);});if(state.photos.length<5){var add=document.createElement('div');add.className='par-thumb-add';add.textContent='+';add.addEventListener('click',function(){galleryInput.click();});thumbsEl.appendChild(add);}thumbsEl.querySelectorAll('.rm').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();var i=parseInt(btn.dataset.i,10);URL.revokeObjectURL(state.photos[i].url);state.photos.splice(i,1);renderThumbs();});});thumbInfo.style.display=state.photos.length?'block':'none';thumbInfo.textContent='올린 사진 '+state.photos.length+' / 5';analyzeBtn.disabled=state.photos.length===0;}
analyzeBtn.addEventListener('click',function(){show('analyzing');var ls=['ana-l1','ana-l2','ana-l3','ana-l4','ana-l5'];var i=1;function step(){if(i>=ls.length){finishAnalysis();return;}var prev=root.querySelector('#'+ls[i-1]);if(prev){prev.classList.remove('cur');prev.classList.add('ok');prev.innerHTML=prev.innerHTML.replace('→','✓');}var cur=root.querySelector('#'+ls[i]);if(cur){cur.style.display='block';cur.classList.add('cur');}i++;setTimeout(step,750);}setTimeout(step,750);});
function finishAnalysis(){var idx=state.photos.length%PROFILES.length;var profile=PROFILES[idx];var bld=(profile.keys.bld&&BLDS.find(function(b){return b.id===profile.keys.bld[0];}))||BLDS[Math.floor(Math.random()*BLDS.length)];var sur=(profile.keys.surf&&SURFS.find(function(s){return s.id===profile.keys.surf[0];}))||SURFS[Math.floor(Math.random()*SURFS.length)];var syms=(profile.keys.symp||['누수','균열']).slice(0,2);var conf=82+Math.floor(Math.random()*12);state.detected={bld:bld,sur:sur,syms:syms,conf:conf,profile:profile};root.querySelector('#par-conf-val').textContent=conf;root.querySelector('#par-d-bld').textContent=bld.ic+' '+bld.name;root.querySelector('#par-d-sur').textContent=sur.ic+' '+sur.name;root.querySelector('#par-d-sym').textContent=syms.join(', ');show('photo-result');}
root.querySelector('#par-confirm-go').addEventListener('click',function(){var d=state.detected;if(!d)return;state.choice={bld:d.bld.id,surf:d.sur.id,syms:d.syms,memo:''};runDiagnosis(d.profile);});
function renderCards(target,items,onPick){var el=root.querySelector(target);el.innerHTML='';items.forEach(function(it){var c=document.createElement('button');c.className='par-card';c.innerHTML='<span class="ic">'+it.ic+'</span><div class="ttl">'+it.name+'</div><div class="desc">'+it.desc+'</div>';c.addEventListener('click',function(){onPick(it);});el.appendChild(c);});}
renderCards('#par-bld-cards',BLDS,function(b){state.choice.bld=b.id;show('manual2');});
renderCards('#par-sur-cards',SURFS,function(s){state.choice.surf=s.id;show('manual3');});
var symList=root.querySelector('#par-sym-list');SYMPS.forEach(function(s){var b=document.createElement('button');b.className='par-sym';b.textContent=s;b.addEventListener('click',function(){b.classList.toggle('on');var i=state.choice.syms.indexOf(s);if(i>=0)state.choice.syms.splice(i,1);else state.choice.syms.push(s);});symList.appendChild(b);});
root.querySelector('#par-go-diag').addEventListener('click',function(){state.choice.memo=(root.querySelector('#par-free-memo').value||'').trim()||state.choice.memo;runDiagnosis(matchProfile(state.choice));});
function matchProfile(c){for(var i=0;i<PROFILES.length;i++){var p=PROFILES[i];if(!p.keys||!p.keys.surf)continue;if(p.keys.surf.indexOf(c.surf)===-1)continue;if(p.keys.bld&&p.keys.bld.indexOf(c.bld)===-1)continue;if(p.keys.symp&&c.syms&&!p.keys.symp.some(function(k){return c.syms.indexOf(k)!==-1;}))continue;return p;}return PROFILES[PROFILES.length-1];}
function runDiagnosis(profile){state.profile=profile;root.querySelector('#par-diag-h').innerHTML=profile.diagH;var ol=root.querySelector('#par-diag-points');ol.innerHTML='';profile.diagPoints.forEach(function(pt){var li=document.createElement('li');li.innerHTML=pt;ol.appendChild(li);});show('diagnosis');}
function safetyOf(surfId){var pro=['roof-shingle','roof-metal','roof-color-steel'];var warn=['wall','window'];if(pro.indexOf(surfId)>=0)return{cls:'pro',label:'⛑️ 안전 시공 권장'};if(warn.indexOf(surfId)>=0)return{cls:'warn',label:'⚠️ 저층 셀프 / 고층 시공연결'};return{cls:'ok',label:'✅ 셀프 가능'};}
function fmtPrice(n){return n.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g,',');}
root.querySelector('#par-go-sol').addEventListener('click',function(){var profile=state.profile||PROFILES[0];var s=profile.sol;root.querySelector('#par-sol-code').textContent=s.code;root.querySelector('#par-sol-name').textContent=s.name;root.querySelector('#par-sol-summary').textContent=s.summary;var pr=root.querySelector('#par-sol-principles');pr.innerHTML='';s.principles.forEach(function(t){var d=document.createElement('div');d.className='pr';d.innerHTML='<span class="dot"></span><span>'+t+'</span>';pr.appendChild(d);});var ev=root.querySelector('#par-sol-evidence');ev.innerHTML='';s.evidence.forEach(function(e){var b=document.createElement('div');b.className='par-ev';b.innerHTML='<div class="lbl">'+e.lbl+'</div><div class="val">'+e.val+(e.unit?'<span class="unit">'+e.unit+'</span>':'')+'</div>'+(e.src?'<div class="src">— '+e.src+'</div>':'');ev.appendChild(b);});var pwrap=root.querySelector('#par-sol-products-wrap');var surfId=(profile.keys&&profile.keys.surf&&profile.keys.surf[0])||'';var sf=safetyOf(surfId);var origTotal=s.products.reduce(function(a,p){return a+parseInt(p.price.replace(/,/g,''),10);},0);var saleTotal=Math.round(origTotal*0.88/1000)*1000;var videoCount=s.products.length+2;var composeNames=s.products.map(function(p){return p.name;}).join(' + ');pwrap.innerHTML='<div class="par-pkg"><span class="badge">⭐ 강력추천 · 풀패키지</span><div class="pkg-name">'+s.name+' 풀세트</div><div class="pkg-meta"><span class="self '+sf.cls+'">'+sf.label+'</span><span>▶ 영상 '+videoCount+'편</span><span>📞 전화 코칭</span></div><div class="pkg-compose"><b>구성:</b>'+composeNames+'</div><div class="pkg-footer"><div class="pkg-price"><span class="orig">'+fmtPrice(origTotal)+'원</span><span class="now">'+fmtPrice(saleTotal)+'</span><span class="won">원~</span><span class="save">12% 할인</span></div><a class="pkg-buy" href="'+(s.packageUrl||'https://www.pourstore.net')+'" target="_blank" rel="noopener">패키지 구매 →</a></div></div><div class="par-products-h">패키지 구성 자재 — 단품 구매도 가능</div><div class="par-products" id="par-sol-products"></div>';var pgrid=pwrap.querySelector('#par-sol-products');s.products.forEach(function(pd){var a=document.createElement('a');a.className='par-pcard';a.href=pd.url;a.target='_blank';a.rel='noopener';a.innerHTML='<div class="img" style="background-image:url(\\''+pd.img+'\\')"><span class="role">'+pd.role+'</span><span class="ext">↗ STORE</span></div><div class="body"><div class="name">'+pd.name+'</div><div class="price">'+pd.price+'<span class="won">원</span></div></div>';pgrid.appendChild(a);});root.querySelector('#par-buy-package').setAttribute('href',s.packageUrl||'https://www.pourstore.net');root.querySelector('#par-consult').setAttribute('href',s.consultUrl||'https://www.poursolution.net/163');var noteEl=root.querySelector('#par-final-note');if(noteEl){noteEl.innerHTML=sf.cls==='pro'?'⛑️ 안전 시공 권장 부위 — <b>안전상 셀프가 어려우시면 시공연결 도와드려요</b> · 시공업자는 자유 구매 OK':sf.cls==='warn'?'<b>저층은 셀프 시공 가능</b> · 고층 외벽은 안전상 시공연결을 도와드려요':'<b>고품질 자재라 영상만 따라하면 누구나 OK</b> · 시공업자도 자유 구매 환영';}show('solution');});
root.querySelector('#par-back-diag').addEventListener('click',function(){show(state.photos.length?'photo-result':'manual3');});
root.querySelector('#par-restart').addEventListener('click',function(){state.photos.forEach(function(p){try{URL.revokeObjectURL(p.url);}catch(e){}});state={screen:'entry',photos:[],detected:null,choice:{bld:null,surf:null,syms:[],memo:''}};renderThumbs();root.querySelectorAll('.par-sym.on').forEach(function(b){b.classList.remove('on');});var memo=root.querySelector('#par-free-memo');if(memo)memo.value='';show('entry');});
show('entry');
})();
</script>
`;

  // 9개 섹션 HTML — builder.js에 SEED_AI_RECOMMEND_HTML 다음에 삽입

  const SEED_BANNER_HTML = `<style>
.psb3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.psb3 { background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 100%); padding:64px 18px 56px; position:relative; overflow:hidden; }
.psb3::before { content:''; position:absolute; top:-100px; right:-100px; width:480px; height:480px; background:radial-gradient(circle, rgba(249,115,22,.16) 0%, transparent 60%); border-radius:50%; pointer-events:none; }
.psb3::after { content:''; position:absolute; bottom:-120px; left:-80px; width:360px; height:360px; background:radial-gradient(circle, rgba(15,31,92,.08) 0%, transparent 60%); border-radius:50%; pointer-events:none; }
.psb3-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1.1fr 1fr; align-items:center; gap:40px; position:relative; z-index:1; }
.psb3-content { color:#0F1F5C; }
.psb3-tag { display:inline-flex; align-items:center; gap:8px; padding:6px 14px; background:#fff; border:1px solid #FED7AA; color:#EA580C; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:18px; box-shadow:0 4px 12px rgba(249,115,22,.1); }
.psb3-tag::before { content:''; width:6px; height:6px; background:#F97316; border-radius:50%; box-shadow:0 0 8px #F97316; animation:psb3-pulse 1.4s infinite; }
@keyframes psb3-pulse { 50%{opacity:.4;} }
.psb3 h1 { font-size:42px; font-weight:900; color:#0F1F5C; line-height:1.2; margin-bottom:18px; letter-spacing:-1.2px; }
.psb3 h1 .accent { color:#F97316; }
.psb3-desc { font-size:15px; color:#4B5563; line-height:1.7; margin-bottom:28px; max-width:480px; }
.psb3-cta { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:32px; }
.psb3-cta a { padding:14px 24px; border-radius:14px; font-size:14px; font-weight:800; text-decoration:none; transition:all .25s; display:inline-flex; align-items:center; gap:6px; letter-spacing:-.2px; }
.psb3-cta .primary { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; box-shadow:0 8px 22px rgba(249,115,22,.3); }
.psb3-cta .primary:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(249,115,22,.4); }
.psb3-cta .ghost { background:#fff; color:#0F1F5C; border:1.5px solid #E5E7EB; }
.psb3-cta .ghost:hover { border-color:#0F1F5C; }
.psb3-stats { display:flex; gap:28px; padding-top:24px; border-top:1px solid #FED7AA; flex-wrap:wrap; }
.psb3-stats .item { color:#0F1F5C; }
.psb3-stats .item .v { font-family:'Bebas Neue',sans-serif; font-size:26px; font-weight:900; line-height:1.1; color:#F97316; letter-spacing:.5px; }
.psb3-stats .item .l { font-size:11.5px; color:#6B7280; margin-top:3px; letter-spacing:.3px; font-weight:600; }
.psb3-visual { position:relative; aspect-ratio:1/1; max-width:460px; margin-left:auto; }
.psb3-visual::before { content:''; position:absolute; inset:30px; background:radial-gradient(circle at center, rgba(249,115,22,.18) 0%, transparent 70%); filter:blur(40px); }
.psb3-product { position:relative; aspect-ratio:1/1; background:linear-gradient(135deg,#FED7AA 0%,#FB923C 50%,#EA580C 100%); border-radius:36px; box-shadow:0 24px 56px rgba(249,115,22,.32), inset 0 -10px 30px rgba(0,0,0,.08); overflow:hidden; }
.psb3-product::before { content:'POUR'; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-8deg); font-family:'Bebas Neue',sans-serif; font-size:120px; font-weight:900; color:rgba(255,255,255,.22); letter-spacing:8px; }
.psb3-product .badge { position:absolute; top:22px; right:22px; padding:8px 14px; background:#fff; border-radius:999px; font-size:11px; font-weight:800; color:#0F1F5C; letter-spacing:.5px; box-shadow:0 6px 18px rgba(0,0,0,.12); }
.psb3-product .corner-tl, .psb3-product .corner-br { position:absolute; width:60px; height:60px; }
.psb3-product .corner-tl { top:18px; left:18px; border-top:2px solid rgba(255,255,255,.4); border-left:2px solid rgba(255,255,255,.4); border-radius:18px 0 0 0; }
.psb3-product .corner-br { bottom:18px; right:18px; border-bottom:2px solid rgba(255,255,255,.4); border-right:2px solid rgba(255,255,255,.4); border-radius:0 0 18px 0; }
.psb3-dots { display:flex; gap:8px; justify-content:center; margin-top:36px; position:relative; z-index:1; }
.psb3-dots span { width:8px; height:8px; border-radius:50%; background:#E5E7EB; transition:all .25s; cursor:pointer; }
.psb3-dots span.on { background:#F97316; width:28px; border-radius:4px; }
@media (max-width:880px) { .psb3-inner { grid-template-columns:1fr; gap:32px; } .psb3 h1 { font-size:30px; } .psb3-desc { font-size:13.5px; } .psb3-visual { max-width:280px; margin:0 auto; } .psb3-stats { gap:20px; } .psb3-stats .item .v { font-size:22px; } .psb3-product::before { font-size:80px; } .psb3 { padding:48px 18px 40px; } }
</style>
<section class="psb3">
  <div class="psb3-inner">
    <div class="psb3-content">
      <span class="psb3-tag">⭐ 베스트셀러 · 올인원 패키지</span>
      <h1>균열·방수·코팅<br/><span class="accent">혼자서도 가능합니다</span></h1>
      <p class="psb3-desc">한 박스에 시공 순서대로 모든 자재를 담았어요.<br/>누구나 따라할 수 있는 POUR 코트재 PRG-100 시리즈.</p>
      <div class="psb3-cta">
        <a class="primary" href="https://www.pourstore.net/category/all-in-one">패키지 둘러보기 →</a>
        <a class="ghost" href="https://www.pourstore.net/guide">시공 가이드</a>
      </div>
      <div class="psb3-stats">
        <div class="item"><div class="v">2,600,000+</div><div class="l">검증된 시공 세대</div></div>
        <div class="item"><div class="v">250+</div><div class="l">전문 파트너사</div></div>
        <div class="item"><div class="v">70+</div><div class="l">특허·인증</div></div>
      </div>
    </div>
    <div class="psb3-visual">
      <div class="psb3-product">
        <span class="corner-tl"></span>
        <span class="corner-br"></span>
        <span class="badge">PRG-100</span>
      </div>
    </div>
  </div>
  <div class="psb3-dots"><span class="on"></span><span></span><span></span></div>
</section>`;

  // 메인 1번 섹션 — 오늘의집 레이아웃 차용 v1 (헤더·탭·2분할 히어로·카테고리 아이콘 10개, 모바일 반응형)
  const OHOUSE_V1_SECTION_HTML = `<section class="psm1">
<style>
.psm1 *, .psm1 *::before, .psm1 *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,Roboto,'Helvetica Neue','Segoe UI','Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.psm1 { background:#fff; color:#2F3438; line-height:1.5; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; letter-spacing:-0.02em; }
.psm1 a { color:inherit; text-decoration:none; }
.psm1 button { background:none; border:none; cursor:pointer; font:inherit; color:inherit; letter-spacing:inherit; }
.psm1 img { display:block; max-width:100%; }
/* 1) 헤더 */
.psm1-hd { border-bottom:1px solid #F2F3F5; }
.psm1-hd-inner { max-width:1256px; margin:0 auto; padding:16px 24px; display:flex; align-items:center; gap:32px; }
.psm1-logo { display:flex; align-items:center; gap:8px; font-weight:800; font-size:22px; color:#0F1F5C; letter-spacing:-0.04em; flex-shrink:0; }
.psm1-logo .psm1-logo-mark { width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg,#F49A3A 0%,#E8780F 100%); display:grid; place-items:center; color:#fff; font-size:14px; font-weight:800; letter-spacing:-0.04em; }
.psm1-gnb { display:flex; gap:24px; align-items:center; }
.psm1-gnb a { font-size:16px; font-weight:700; color:#424242; padding:6px 0; letter-spacing:-0.03em; }
.psm1-gnb a.on { color:#E8780F; }
.psm1-gnb a:hover { color:#E8780F; }
.psm1-search { flex:1; max-width:480px; position:relative; }
.psm1-search input { width:100%; padding:11px 52px 11px 44px; font-size:14px; font-weight:400; letter-spacing:-0.02em; background:#F5F6F8; border:1px solid #F5F6F8; border-radius:24px; outline:none; transition:.15s; color:#2F3438; }
.psm1-search input::placeholder { color:#9E9E9E; font-weight:400; }
.psm1-search input:focus { background:#fff; border-color:#E8780F; }
.psm1-search .psm1-search-ico { position:absolute; left:16px; top:50%; transform:translateY(-50%); width:18px; height:18px; opacity:.55; pointer-events:none; }
/* 검색창 우측 마스코트 요정 — 살랑살랑 떠다니는 POUR닥터 */
.psm1-fairy { position:absolute; right:6px; top:50%; transform:translateY(-50%); width:36px; height:36px; border:none; background:none; padding:0; cursor:pointer; z-index:4; line-height:0; }
.psm1-fairy-glow { position:absolute; inset:-5px; border-radius:50%; background:radial-gradient(circle, rgba(232,120,15,.32) 0%, transparent 68%); z-index:0; animation:psm1FairyGlow 3s ease-in-out infinite; }
@keyframes psm1FairyGlow { 0%,100% { opacity:.45; transform:scale(.85); } 50% { opacity:.85; transform:scale(1.12); } }
.psm1-fairy img { position:relative; z-index:1; width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 2px 3px rgba(15,31,92,.2)); animation:psm1FairyBob 3s ease-in-out infinite; }
@keyframes psm1FairyBob { 0%,100% { transform:translateY(0) rotate(-4deg); } 50% { transform:translateY(-3px) rotate(4deg); } }
.psm1-fairy-spark { position:absolute; top:-3px; right:-2px; z-index:2; font-size:11px; pointer-events:none; animation:psm1FairySpark 2.4s ease-in-out infinite; }
@keyframes psm1FairySpark { 0%,100% { opacity:0; transform:scale(.5) rotate(0deg); } 45% { opacity:1; transform:scale(1) rotate(15deg); } }
.psm1-fairy:hover img { animation-play-state:paused; transform:translateY(-2px) rotate(0deg) scale(1.12); }
.psm1-fairy-tip { position:absolute; right:0; top:calc(100% + 9px); white-space:nowrap; background:#0F1F5C; color:#fff; font-size:11.5px; font-weight:700; letter-spacing:-0.02em; padding:6px 11px; border-radius:9px; box-shadow:0 6px 16px rgba(15,31,92,.22); opacity:0; transform:translateY(-4px); pointer-events:none; transition:.18s; z-index:5; }
.psm1-fairy-tip::before { content:''; position:absolute; right:13px; top:-4px; width:8px; height:8px; background:#0F1F5C; transform:rotate(45deg); }
.psm1-fairy:hover .psm1-fairy-tip { opacity:1; transform:translateY(0); }
/* POUR닥터 헬퍼 (검색 포커스 시 펼침) */
.psm1-helper { position:absolute; top:calc(100% + 10px); left:0; right:0; background:#fff; border:1px solid #F2F3F5; border-radius:18px; box-shadow:0 16px 48px rgba(15,31,92,.14), 0 4px 12px rgba(15,31,92,.08); padding:18px; display:flex; gap:14px; opacity:0; pointer-events:none; transform:translateY(-6px); transition:all .22s cubic-bezier(.16,1,.3,1); z-index:50; }
.psm1-helper.open { opacity:1; pointer-events:auto; transform:translateY(0); }
.psm1-helper::before { content:''; position:absolute; top:-7px; left:32px; width:14px; height:14px; background:#fff; border-left:1px solid #F2F3F5; border-top:1px solid #F2F3F5; transform:rotate(45deg); }
.psm1-helper-char { flex-shrink:0; width:96px; height:104px; border-radius:14px; overflow:hidden; background:linear-gradient(180deg,#FFF6EC 0%,#FFE7CB 100%); align-self:center; display:flex; align-items:center; justify-content:center; }
.psm1-helper-char svg, .psm1-helper-char img { width:100%; height:100%; object-fit:contain; object-position:center; display:block; }
.psm1-helper-bubble { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
.psm1-helper-msg { font-size:14px; font-weight:600; color:#2F3438; line-height:1.5; letter-spacing:-0.03em; }
.psm1-helper-msg b { color:#E8780F; font-weight:800; }
.psm1-helper-chips { display:flex; flex-wrap:wrap; gap:6px; }
.psm1-helper-chip { padding:7px 12px; font-size:12.5px; font-weight:600; color:#374151; background:#F5F6F8; border:1px solid #F5F6F8; border-radius:999px; cursor:pointer; transition:.15s; letter-spacing:-0.02em; font-family:inherit; }
.psm1-helper-chip:hover { background:#FFF7ED; border-color:#FED7AA; color:#E8780F; }
.psm1-helper-more { display:inline-block; margin-top:2px; font-size:12.5px; font-weight:700; color:#0F1F5C; letter-spacing:-0.02em; text-decoration:none; }
.psm1-helper-more:hover { color:#E8780F; }
.psm1-util { display:flex; align-items:center; gap:18px; margin-left:auto; }
.psm1-util a { font-size:13px; font-weight:500; color:#757575; letter-spacing:-0.02em; }
.psm1-util a:hover { color:#2F3438; }
.psm1-util .psm1-cart { width:24px; height:24px; opacity:.7; }
.psm1-write { display:inline-flex; align-items:center; gap:4px; padding:8px 16px; background:#E8780F; color:#fff !important; border-radius:20px; font-size:14px; font-weight:700; letter-spacing:-0.03em; }
.psm1-write:hover { background:#C8650D; }
.psm1-hd-mb { display:none; }
/* 2) 카테고리 탭 */
.psm1-tabs { border-bottom:1px solid #F2F3F5; background:#fff; }
.psm1-tabs-inner { max-width:1256px; margin:0 auto; padding:0 24px; display:flex; align-items:center; gap:0; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none; }
.psm1-tabs-inner::-webkit-scrollbar { display:none; }
.psm1-tab { padding:16px 14px; font-size:15px; font-weight:600; color:#757575; white-space:nowrap; border-bottom:2px solid transparent; margin-bottom:-1px; transition:.15s; letter-spacing:-0.03em; }
.psm1-tab.on { color:#E8780F; border-color:#E8780F; font-weight:700; }
.psm1-tab:hover { color:#2F3438; }
.psm1-tab .psm1-tab-new { display:inline-block; font-size:10px; font-weight:800; color:#E8780F; vertical-align:top; margin-left:2px; letter-spacing:0; }
.psm1-tabs-tail { margin-left:auto; display:flex; align-items:center; gap:8px; padding:10px 0; flex-shrink:0; }
.psm1-tabs-tail .psm1-tail-count { width:24px; height:24px; border-radius:50%; background:#FFF7ED; color:#E8780F; font-size:12px; font-weight:800; display:grid; place-items:center; letter-spacing:-0.02em; }
.psm1-tabs-tail .psm1-tail-txt { font-size:14px; color:#2F3438; font-weight:600; letter-spacing:-0.03em; }
.psm1-tabs-tail .psm1-tail-new { font-size:10px; font-weight:800; color:#E8780F; padding:2px 4px; border-radius:3px; background:#FFEDD5; letter-spacing:0; }
.psm1-tabs-tail .psm1-tail-chev { font-size:12px; color:#9CA3AF; }
/* 3) 히어로 배너 (2분할) */
.psm1-hero { background:#fff; padding:20px 24px 0; }
.psm1-hero-inner { max-width:1256px; margin:0 auto; display:grid; grid-template-columns:1fr 320px; gap:20px; }
.psm1-banner { position:relative; border-radius:12px; overflow:hidden; aspect-ratio:16/9; background:#F5F6F8; cursor:pointer; }
.psm1-banner-img { width:100%; height:100%; object-fit:cover; }
.psm1-banner-grad { position:absolute; inset:0; background:linear-gradient(180deg, transparent 40%, rgba(0,0,0,.55) 100%); }
.psm1-banner-cap { position:absolute; left:24px; right:24px; bottom:24px; color:#fff; }
.psm1-banner-cap .tag { display:inline-block; font-size:12px; font-weight:700; padding:4px 9px; background:rgba(232,120,15,.92); border-radius:4px; margin-bottom:10px; letter-spacing:-0.02em; }
.psm1-banner-cap .title { font-size:22px; font-weight:800; line-height:1.35; letter-spacing:-0.04em; text-shadow:0 2px 8px rgba(0,0,0,.3); }
.psm1-banner-cap .author { margin-top:8px; font-size:12px; font-weight:500; opacity:.95; display:flex; align-items:center; gap:5px; letter-spacing:-0.02em; }
.psm1-banner-cap .author .av { width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg,#F49A3A,#E8780F); display:grid; place-items:center; font-size:10px; font-weight:800; }
.psm1-banner-counter { position:absolute; right:14px; bottom:14px; background:rgba(15,23,42,.65); color:#fff; font-size:11px; font-weight:600; padding:4px 9px; border-radius:12px; backdrop-filter:blur(4px); letter-spacing:-0.02em; }
.psm1-banner-side { position:relative; border-radius:12px; overflow:hidden; aspect-ratio:auto; background:linear-gradient(160deg,#E8780F 0%,#F49A3A 60%,#FED7AA 100%); cursor:pointer; display:flex; flex-direction:column; padding:20px 22px; min-height:100%; }
.psm1-banner-side .ad { display:inline-block; font-size:10px; font-weight:700; padding:2px 6px; background:rgba(255,255,255,.85); color:#7C2D12; border-radius:3px; align-self:flex-start; letter-spacing:0.02em; }
.psm1-banner-side .label { margin-top:18px; font-size:12px; font-weight:600; color:#7C2D12; letter-spacing:-0.02em; }
.psm1-banner-side .title { margin-top:6px; font-size:20px; font-weight:800; color:#fff; line-height:1.3; letter-spacing:-0.04em; }
.psm1-banner-side .product { margin-top:auto; padding-top:20px; align-self:center; display:grid; place-items:center; }
.psm1-banner-side .product-mock { width:120px; height:140px; background:rgba(255,255,255,.92); border-radius:10px; box-shadow:0 8px 24px rgba(124,45,18,.18); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#0F1F5C; }
.psm1-banner-side .product-mock .pm-pkg { font-size:36px; }
.psm1-banner-side .product-mock .pm-name { font-size:10px; font-weight:700; color:#7C2D12; letter-spacing:0.02em; }
/* 4) 카테고리 아이콘 */
.psm1-cats { padding:30px 24px 36px; }
.psm1-cats-inner { max-width:1256px; margin:0 auto; display:grid; grid-template-columns:repeat(10,1fr); gap:8px; }
.psm1-cat { display:flex; flex-direction:column; align-items:center; gap:8px; padding:8px 4px; border-radius:12px; cursor:pointer; transition:.15s; }
.psm1-cat:hover { background:#FAFAFA; }
.psm1-cat-ico { width:54px; height:54px; border-radius:14px; background:#F5F6F8; display:grid; place-items:center; font-size:24px; }
.psm1-cat-ico.c1 { background:#F3E8FF; color:#7C3AED; }
.psm1-cat-ico.c2 { background:#FFE4E6; color:#E11D48; }
.psm1-cat-ico.c3 { background:#DBEAFE; color:#2563EB; }
.psm1-cat-ico.c4 { background:#DCFCE7; color:#059669; }
.psm1-cat-ico.c5 { background:#FCE7F3; color:#DB2777; }
.psm1-cat-ico.c6 { background:#F1F5F9; color:#475569; }
.psm1-cat-ico.c7 { background:#FFEDD5; color:#EA580C; }
.psm1-cat-ico.c8 { background:#E0F2FE; color:#0284C7; }
.psm1-cat-ico.c9 { background:#CFFAFE; color:#0891B2; }
.psm1-cat-ico.c10 { background:#FEE2E2; color:#DC2626; }
.psm1-cat-name { font-size:13px; font-weight:500; color:#2F3438; text-align:center; letter-spacing:-0.03em; }
/* 모바일 반응형 */
@media (max-width: 900px) {
  .psm1-hero-inner { grid-template-columns:1fr 220px; gap:12px; }
  .psm1-banner-side { padding:16px; }
  .psm1-banner-side .title { font-size:16px; }
  .psm1-banner-cap .title { font-size:18px; }
  .psm1-cats-inner { grid-template-columns:repeat(5,1fr); row-gap:18px; }
}
@media (max-width: 700px) {
  .psm1-hd-inner { display:none; }
  .psm1-hd-mb { display:block; padding:12px 14px 14px; position:relative; overflow:visible; z-index:20; }
  .psm1-mb-top { display:grid; grid-template-columns:40px 1fr 40px; align-items:center; }
  .psm1-hd-mb .psm1-mb-menu, .psm1-hd-mb .psm1-mb-cart { width:40px; height:40px; display:grid; place-items:center; font-size:22px; color:#374151; }
  .psm1-hd-mb .psm1-mb-logo { display:flex; align-items:center; justify-content:center; gap:7px; font-weight:800; font-size:19px; color:#0F1F5C; letter-spacing:-0.04em; }
  .psm1-hd-mb .psm1-mb-logo .psm1-logo-mark { width:26px; height:26px; font-size:12px; font-weight:800; letter-spacing:-0.04em; }
  /* 모바일 전체폭 검색바 + 그 위에 걸터앉은 POUR닥터 요정 */
  .psm1-mb-searchbar { position:relative; margin-top:14px; display:flex; align-items:center; gap:8px; background:#F5F6F8; border:1px solid #ECEEF1; border-radius:26px; padding:12px 16px; cursor:pointer; }
  .psm1-mb-searchbar .psm1-mb-search-ico { width:18px; height:18px; color:#9E9E9E; flex-shrink:0; }
  .psm1-mb-searchbar input { flex:1; min-width:0; border:none; background:none; outline:none; font-size:14px; color:#2F3438; letter-spacing:-0.02em; cursor:pointer; }
  .psm1-mb-searchbar input::placeholder { color:#9E9E9E; }
  .psm1-mb-doctor { position:absolute; right:10px; top:-26px; width:60px; height:60px; padding:0; border:none; background:none; cursor:pointer; line-height:0; z-index:21; }
  .psm1-mb-doctor-glow { position:absolute; inset:-4px; bottom:8px; border-radius:50%; background:radial-gradient(circle, rgba(232,120,15,.3) 0%, transparent 68%); animation:psm1FairyGlow 3s ease-in-out infinite; z-index:0; }
  .psm1-mb-doctor img { position:relative; z-index:1; width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 4px 7px rgba(15,31,92,.24)); animation:psm1FairyBob 3s ease-in-out infinite; }
  .psm1-mb-doctor-spark { position:absolute; top:2px; right:4px; z-index:2; font-size:13px; pointer-events:none; animation:psm1FairySpark 2.4s ease-in-out infinite; }
  /* 모바일: 헬퍼는 화면 좌우 가득, 캐릭터 작게 */
  .psm1-helper { left:14px; right:14px; padding:14px; gap:10px; border-radius:14px; }
  .psm1-helper-char { width:72px; height:80px; border-radius:12px; }
  .psm1-helper-msg { font-size:13px; }
  .psm1-helper-chip { padding:6px 10px; font-size:12px; }
  .psm1-tabs-inner { padding:0 14px; }
  .psm1-tab { font-size:14px; padding:14px 10px; }
  .psm1-tabs-tail { display:none; }
  .psm1-hero { padding:14px 14px 0; }
  .psm1-hero-inner { grid-template-columns:1fr; gap:10px; }
  .psm1-banner { aspect-ratio:4/3; border-radius:10px; }
  .psm1-banner-cap { left:16px; right:16px; bottom:16px; }
  .psm1-banner-cap .title { font-size:18px; }
  .psm1-banner-side { aspect-ratio:auto; min-height:140px; flex-direction:row; align-items:center; gap:14px; padding:16px 18px; border-radius:10px; }
  .psm1-banner-side .label { margin-top:0; }
  .psm1-banner-side .title { font-size:17px; }
  .psm1-banner-side .product { margin:0 0 0 auto; padding:0; }
  .psm1-banner-side .product-mock { width:88px; height:96px; }
  .psm1-banner-side .product-mock .pm-pkg { font-size:28px; }
  .psm1-banner-side .ad { position:absolute; top:12px; right:12px; }
  .psm1-banner-side .text-wrap { display:flex; flex-direction:column; gap:4px; }
  .psm1-cats { padding:22px 8px 28px; }
  .psm1-cats-inner { grid-template-columns:repeat(5,1fr); row-gap:18px; gap:0; }
  .psm1-cat-ico { width:48px; height:48px; font-size:22px; border-radius:14px; }
  .psm1-cat-name { font-size:11.5px; }
}
</style>
<header class="psm1-hd">
  <div class="psm1-hd-inner">
    <a href="#" class="psm1-logo"><span class="psm1-logo-mark">P</span><span>POUR스토어</span></a>
    <nav class="psm1-gnb">
      <a href="#" class="on">자재찾기</a>
      <a href="#">패키지</a>
      <a href="#">시공가이드</a>
    </nav>
    <div class="psm1-search" data-psm1-search>
      <svg class="psm1-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="text" placeholder="어떤 어려움이 있으세요? (예: 옥상 누수, 외벽 균열)" aria-label="통합검색"/>
      <!-- 검색창 우측 마스코트 요정 — 클릭 시 진단 헬퍼 펼침 -->
      <button type="button" class="psm1-fairy" data-psm1-fairy aria-label="POUR닥터에게 물어보기">
        <span class="psm1-fairy-glow"></span>
        <img src="https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/%EB%A7%88%EC%8A%A4%EC%BD%94%ED%8A%B8%2Fbeaver_search_fairy_nukki.png?alt=media&token=fb1415e6-cc88-48eb-9627-3d214b1ebaa8" alt="POUR닥터" loading="lazy"/>
        <span class="psm1-fairy-spark">✨</span>
        <span class="psm1-fairy-tip">무엇이든 물어보세요!</span>
      </button>
      <!-- 검색 포커스 시 펼쳐지는 POUR닥터 헬퍼 (캐릭터 + 말풍선 + 추천 칩) -->
      <div class="psm1-helper" data-psm1-helper>
        <div class="psm1-helper-char">
          <img src="https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/%EB%A7%88%EC%8A%A4%EC%BD%94%ED%8A%B8%2Fbeaver_quickbanner_gown_circle_noborder.png?alt=media&token=1b20bea5-1fde-44aa-87bd-18a116b1eeee" alt="POUR닥터" loading="lazy"/>
        </div>
        <div class="psm1-helper-bubble">
          <div class="psm1-helper-msg">어떤 <b>어려움</b>이 있으세요?<br/>편하게 말씀해 주세요. <b>사진</b>으로도 가능해요!</div>
          <div class="psm1-helper-chips">
            <button type="button" class="psm1-helper-chip">💧 옥상 누수</button>
            <button type="button" class="psm1-helper-chip">⚡ 외벽 균열</button>
            <button type="button" class="psm1-helper-chip">🦠 곰팡이·결로</button>
            <button type="button" class="psm1-helper-chip">🧱 박락·박리</button>
            <button type="button" class="psm1-helper-chip">🟫 녹·부식</button>
            <button type="button" class="psm1-helper-chip">🎨 도장 열화</button>
          </div>
          <a class="psm1-helper-more" href="./pour-doctor.html">또는 사진으로 진단받기 →</a>
        </div>
      </div>
    </div>
    <div class="psm1-util">
      <a href="#" aria-label="장바구니"><svg class="psm1-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M3 4h2l2.5 12h12l2-8H6"/></svg></a>
      <a href="#">로그인</a>
      <a href="#">회원가입</a>
      <a href="#">고객센터</a>
      <a href="#" class="psm1-write">견적요청 ▾</a>
    </div>
  </div>
  <div class="psm1-hd-mb">
    <div class="psm1-mb-top">
      <button class="psm1-mb-menu" aria-label="메뉴">☰</button>
      <a href="#" class="psm1-mb-logo"><span>POUR스토어</span></a>
      <button class="psm1-mb-cart" aria-label="장바구니"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M3 4h2l2.5 12h12l2-8H6"/></svg></button>
    </div>
    <div class="psm1-mb-searchbar" data-psm1-mb-search>
      <svg class="psm1-mb-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="text" placeholder="어떤 어려움이 있으세요? (예: 옥상 누수)" aria-label="통합검색" readonly/>
      <button class="psm1-mb-doctor" data-psm1-fairy aria-label="POUR닥터에게 물어보기">
        <span class="psm1-mb-doctor-glow"></span>
        <img src="https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/%EB%A7%88%EC%8A%A4%EC%BD%94%ED%8A%B8%2Fbeaver_search_fairy_nukki.png?alt=media&token=fb1415e6-cc88-48eb-9627-3d214b1ebaa8" alt="POUR닥터" loading="lazy"/>
        <span class="psm1-mb-doctor-spark">✨</span>
      </button>
    </div>
  </div>
</header>
<nav class="psm1-tabs" aria-label="카테고리 탭">
  <div class="psm1-tabs-inner">
    <a href="#" class="psm1-tab on">홈</a>
    <a href="#" class="psm1-tab">추천</a>
    <a href="#" class="psm1-tab">베스트</a>
    <a href="#" class="psm1-tab">신상품</a>
    <a href="#" class="psm1-tab">셀프시공</a>
    <a href="#" class="psm1-tab">시공가이드</a>
    <a href="/pourstore_renewal/story/case.html" class="psm1-tab">시공사례</a>
    <a href="#" class="psm1-tab">쇼핑수다</a>
    <a href="/pourstore_renewal/story/event.html" class="psm1-tab">이벤트</a>
    <a href="#" class="psm1-tab">패키지 NEW <span class="psm1-tab-new">N</span></a>
    <div class="psm1-tabs-tail">
      <span class="psm1-tail-count">3</span>
      <span class="psm1-tail-txt">자재함</span>
      <span class="psm1-tail-new">NEW</span>
      <span class="psm1-tail-chev">▾</span>
    </div>
  </div>
</nav>
<div class="psm1-hero">
  <div class="psm1-hero-inner">
    <div class="psm1-banner" role="button" tabindex="0">
      <svg class="psm1-banner-img" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="psm1bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E9DB"/><stop offset=".55" stop-color="#E8D7BC"/><stop offset="1" stop-color="#B89A77"/></linearGradient>
          <linearGradient id="psm1sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE6B8"/><stop offset="1" stop-color="#F49A3A" stop-opacity=".55"/></linearGradient>
        </defs>
        <rect width="1280" height="720" fill="url(#psm1bg)"/>
        <rect x="180" y="120" width="700" height="430" fill="#E8F0EE" opacity=".85"/>
        <rect x="180" y="120" width="700" height="430" fill="url(#psm1sun)" opacity=".55"/>
        <g stroke="#fff" stroke-width="6" opacity=".85"><line x1="530" y1="120" x2="530" y2="550"/><line x1="180" y1="335" x2="880" y2="335"/></g>
        <ellipse cx="780" cy="560" rx="55" ry="14" fill="#3D4A33" opacity=".4"/>
        <path d="M730 555 q50 -120 100 0 z" fill="#3F6B47"/>
        <rect x="745" y="555" width="70" height="40" rx="6" fill="#7C4A2A"/>
        <rect x="240" y="560" width="380" height="110" rx="14" fill="#C2A485"/>
        <rect x="240" y="540" width="380" height="40" rx="14" fill="#A88564"/>
        <line x1="160" y1="680" x2="160" y2="280" stroke="#3D2A1C" stroke-width="5"/>
        <ellipse cx="160" cy="270" rx="50" ry="32" fill="#F5E8C8"/>
      </svg>
      <div class="psm1-banner-grad"></div>
      <div class="psm1-banner-cap">
        <span class="tag">#방수패키지</span>
        <div class="title">옥상 누수, 한 번에 끝내는 셀프 방수 패키지</div>
        <div class="author"><span class="av">P</span>@pour_official</div>
      </div>
      <div class="psm1-banner-counter">1 / 15 +</div>
    </div>
    <div class="psm1-banner-side" role="button" tabindex="0">
      <span class="ad">AD</span>
      <div class="text-wrap">
        <div class="label">POUR스토어 단하루 특가</div>
        <div class="title">방수 자재 60% ↓<br/>주말 한정</div>
      </div>
      <div class="product"><div class="product-mock"><span class="pm-pkg">🪣</span><span class="pm-name">방수 자재</span></div></div>
    </div>
  </div>
</div>
<nav class="psm1-cats" aria-label="빠른 메뉴">
  <div class="psm1-cats-inner">
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c1">🏷</span><span class="psm1-cat-name">쇼핑하기</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c2">⚡</span><span class="psm1-cat-name">오늘의딜</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c3">🔍</span><span class="psm1-cat-name">시공가이드</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c4">✅</span><span class="psm1-cat-name">출석체크</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c5">📦</span><span class="psm1-cat-name">패키지할인</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c6">📸</span><span class="psm1-cat-name">후기참여</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c7">🛒</span><span class="psm1-cat-name">자재마트</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c8">🚚</span><span class="psm1-cat-name">원하는날도착</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c9">🧹</span><span class="psm1-cat-name">시공·상담</span></a>
    <a href="#" class="psm1-cat"><span class="psm1-cat-ico c10">📡</span><span class="psm1-cat-name">견적신청</span></a>
  </div>
</nav>
<script>
(function(){
  var root = document.currentScript && document.currentScript.parentElement;
  if (!root) return;
  // 검색 포커스 시 POUR닥터 헬퍼 펼침 (B 옵션)
  root.querySelectorAll('[data-psm1-search]').forEach(function(box){
    var input = box.querySelector('input');
    var helper = box.querySelector('[data-psm1-helper]');
    if (!input || !helper) return;
    var blurTimer = null;
    input.addEventListener('focus', function(){
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
      helper.classList.add('open');
    });
    input.addEventListener('blur', function(){
      // 칩 클릭 시점에 blur가 먼저 떠서 닫힘 → 짧은 지연
      blurTimer = setTimeout(function(){ helper.classList.remove('open'); }, 180);
    });
    helper.addEventListener('mousedown', function(e){ e.preventDefault(); }); // blur 방지
    // 마스코트 요정 클릭 → 검색 포커스 + 헬퍼 펼침
    var fairy = box.querySelector('[data-psm1-fairy]');
    if (fairy) {
      fairy.addEventListener('mousedown', function(e){ e.preventDefault(); });
      fairy.addEventListener('click', function(e){
        e.preventDefault();
        input.focus();
        helper.classList.add('open');
      });
    }
    helper.querySelectorAll('.psm1-helper-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        var txt = chip.textContent.replace(/^[^\\s]+\\s/, '').trim(); // 이모지 제거
        input.value = txt;
        input.focus();
      });
    });
  });
  // 모바일 검색바·마스코트 — 탭하면 진단 페이지로 이동
  var mbGo = function(e){ if(e) e.preventDefault(); window.location.href = './pour-doctor.html'; };
  var mbDoctor = root.querySelector('.psm1-mb-doctor');
  if (mbDoctor) mbDoctor.addEventListener('click', mbGo);
  var mbBar = root.querySelector('[data-psm1-mb-search]');
  if (mbBar) mbBar.addEventListener('click', mbGo);
})();
</script>
</section>`;

  // 메인 2번 섹션 — 오늘의집 "이런 사진 찾고 있나요?" 스타일 (가로 스크롤 카드 + 필터칩, 1:1 비율)
  const OHOUSE_SECTION2_HTML = `<section class="psm2">
<style>
.psm2 *, .psm2 *::before, .psm2 *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,Roboto,'Helvetica Neue','Segoe UI','Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.psm2 { background:#fff; padding:36px 24px; color:#2F3438; letter-spacing:-0.02em; -webkit-font-smoothing:antialiased; }
.psm2 a { color:inherit; text-decoration:none; }
.psm2 button { background:none; border:none; cursor:pointer; font:inherit; color:inherit; letter-spacing:inherit; }
.psm2-inner { max-width:1256px; margin:0 auto; }
.psm2-group + .psm2-group { margin-top:40px; padding-top:40px; border-top:1px solid #F2F3F5; }
/* 헤더 */
.psm2-head { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; margin-bottom:14px; }
.psm2-title-wrap { flex:1; min-width:0; }
.psm2-title { font-size:24px; font-weight:800; color:#111111; letter-spacing:-0.04em; line-height:1.3; }
.psm2-subtitle { margin-top:6px; font-size:14px; font-weight:500; color:#888888; letter-spacing:-0.02em; }
.psm2-more { display:inline-flex; align-items:center; gap:2px; font-size:14px; font-weight:600; color:#2F3438; padding:6px 0 6px 12px; flex-shrink:0; letter-spacing:-0.03em; }
.psm2-more:hover { color:#E8780F; }
/* 필터 칩 */
.psm2-filters { display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; }
.psm2-filter { padding:8px 16px; font-size:14px; font-weight:600; color:#2F3438; background:#fff; border:1px solid #E5E7EB; border-radius:999px; cursor:pointer; transition:.15s; letter-spacing:-0.03em; }
.psm2-filter:hover { border-color:#9CA3AF; background:#FAFAFA; }
.psm2-filter.on { background:#E8780F; border-color:#E8780F; color:#fff; }
.psm2-filter.on:hover { background:#C8650D; border-color:#C8650D; }
/* 가로 스크롤 카드 */
.psm2-scroll-wrap { position:relative; }
.psm2-scroll { display:grid; grid-auto-flow:column; grid-auto-columns:calc((100% - 48px) / 4); gap:16px; overflow-x:auto; scroll-snap-type:x mandatory; padding-bottom:8px; scrollbar-width:none; -ms-overflow-style:none; }
.psm2-scroll::-webkit-scrollbar { display:none; }
.psm2-card { position:relative; scroll-snap-align:start; cursor:pointer; }
.psm2-card-img { position:relative; aspect-ratio:1/1; border-radius:14px; overflow:hidden; background:#F5F6F8; }
.psm2-card-img svg, .psm2-card-img img { width:100%; height:100%; object-fit:cover; display:block; }
.psm2-card-tag { position:absolute; left:12px; top:12px; padding:5px 10px; background:rgba(232,120,15,.95); color:#fff; font-size:11.5px; font-weight:700; border-radius:5px; letter-spacing:-0.02em; }
.psm2-card-bookmark { position:absolute; right:10px; bottom:10px; width:32px; height:32px; background:rgba(255,255,255,.92); border-radius:50%; display:grid; place-items:center; box-shadow:0 2px 6px rgba(0,0,0,.12); border:none; cursor:pointer; transition:.15s; }
.psm2-card-bookmark:hover { background:#fff; transform:scale(1.06); }
.psm2-card-bookmark svg { width:15px; height:15px; color:#2F3438; }
.psm2-card-bottom { position:absolute; left:10px; bottom:10px; display:flex; align-items:center; gap:7px; padding:5px 11px 5px 5px; background:rgba(255,255,255,.92); border-radius:999px; backdrop-filter:blur(6px); max-width:calc(100% - 60px); }
.psm2-card-av { width:24px; height:24px; border-radius:50%; background:linear-gradient(135deg,#F49A3A,#E8780F); color:#fff; display:grid; place-items:center; font-size:10.5px; font-weight:800; flex-shrink:0; letter-spacing:-0.04em; }
.psm2-card-name { font-size:12px; font-weight:600; color:#2F3438; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-0.02em; }
.psm2-card-info { margin-top:10px; padding:0 2px; }
.psm2-card-title { font-size:14px; font-weight:600; color:#2F3438; letter-spacing:-0.03em; line-height:1.4; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; min-height:39px; }
.psm2-card-price { margin-top:5px; display:flex; align-items:baseline; gap:6px; }
.psm2-card-price .disc { font-size:14px; font-weight:800; color:#E8780F; letter-spacing:-0.02em; }
.psm2-card-price .now { font-size:14px; font-weight:700; color:#111111; letter-spacing:-0.02em; }
/* 좌우 화살표 */
.psm2-arrow { position:absolute; top:calc(50% - 30px); transform:translateY(-50%); width:42px; height:42px; background:#fff; border-radius:50%; box-shadow:0 4px 16px rgba(0,0,0,.16); display:grid; place-items:center; cursor:pointer; z-index:2; transition:.15s; border:1px solid #F2F3F5; color:#2F3438; }
.psm2-arrow:hover { background:#FAFAFA; box-shadow:0 6px 22px rgba(0,0,0,.22); }
.psm2-arrow.prev { left:-14px; }
.psm2-arrow.next { right:-14px; }
.psm2-arrow svg { width:18px; height:18px; }
/* 카드 컬러 — 철재 (메탈 그레이/네이비) */
.thb-m1 { background:linear-gradient(135deg,#7B8794 0%,#3E4C59 100%); }
.thb-m2 { background:linear-gradient(135deg,#A0AEC0 0%,#4A5568 100%); }
.thb-m3 { background:linear-gradient(135deg,#CBD5E0 0%,#718096 100%); }
.thb-m4 { background:linear-gradient(135deg,#E8780F 0%,#C8650D 100%); }
.thb-m5 { background:linear-gradient(135deg,#0F1F5C 0%,#1E3A8A 100%); }
.thb-m6 { background:linear-gradient(135deg,#52525B 0%,#27272A 100%); }
.thb-m7 { background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%); }
.thb-m8 { background:linear-gradient(135deg,#475569 0%,#1E293B 100%); }
/* 카드 컬러 — 목재 (우드 브라운/오크) */
.thb-w1 { background:linear-gradient(135deg,#D7B899 0%,#8B5A3C 100%); }
.thb-w2 { background:linear-gradient(135deg,#C19A6B 0%,#6B4423 100%); }
.thb-w3 { background:linear-gradient(135deg,#DEB887 0%,#A0826D 100%); }
.thb-w4 { background:linear-gradient(135deg,#E8780F 0%,#7C4A2A 100%); }
.thb-w5 { background:linear-gradient(135deg,#A0826D 0%,#5C3A1F 100%); }
.thb-w6 { background:linear-gradient(135deg,#F5DEB3 0%,#A67B5B 100%); }
.thb-w7 { background:linear-gradient(135deg,#B8743A 0%,#4A2C18 100%); }
.thb-w8 { background:linear-gradient(135deg,#D2A679 0%,#7A5230 100%); }
/* 카드 컬러 — 돌/시멘트 (콘크리트 쿨그레이) */
.thb-c1 { background:linear-gradient(135deg,#9CA3AF 0%,#374151 100%); }
.thb-c2 { background:linear-gradient(135deg,#D1D5DB 0%,#6B7280 100%); }
.thb-c3 { background:linear-gradient(135deg,#71717A 0%,#27272A 100%); }
.thb-c4 { background:linear-gradient(135deg,#E8780F 0%,#52525B 100%); }
.thb-c5 { background:linear-gradient(135deg,#A8A29E 0%,#44403C 100%); }
.thb-c6 { background:linear-gradient(135deg,#E5E7EB 0%,#9CA3AF 100%); }
.thb-c7 { background:linear-gradient(135deg,#57534E 0%,#1C1917 100%); }
.thb-c8 { background:linear-gradient(135deg,#78716C 0%,#292524 100%); }
/* 모바일 반응형 */
@media (max-width: 900px) {
  .psm2-scroll { grid-auto-columns:calc((100% - 32px) / 3); }
  .psm2-arrow { display:none; }
}
@media (max-width: 700px) {
  .psm2 { padding:24px 14px 28px; }
  .psm2-group + .psm2-group { margin-top:28px; padding-top:28px; }
  .psm2-title { font-size:20px; }
  .psm2-subtitle { font-size:13px; }
  .psm2-more { font-size:13px; }
  .psm2-filter { padding:7px 13px; font-size:13px; }
  .psm2-scroll { grid-auto-columns:46%; gap:10px; }
  .psm2-card-img { border-radius:12px; }
  .psm2-card-tag { font-size:10.5px; padding:3px 7px; left:10px; top:10px; }
  .psm2-card-bookmark { width:28px; height:28px; right:8px; bottom:8px; }
  .psm2-card-bottom { padding:4px 9px 4px 4px; left:8px; bottom:8px; }
  .psm2-card-av { width:20px; height:20px; font-size:9.5px; }
  .psm2-card-name { font-size:11px; max-width:90px; }
  .psm2-card-title { font-size:13px; min-height:36px; }
  .psm2-card-price .disc, .psm2-card-price .now { font-size:13px; }
}
</style>
<div class="psm2-inner">

  <!-- ===== 그룹 1: 철재 ===== -->
  <div class="psm2-group" data-material="철재">
    <div class="psm2-head">
      <div class="psm2-title-wrap">
        <div class="psm2-title">철재를 고치고 싶다면?</div>
        <div class="psm2-subtitle">녹·부식·찍힘까지 — POUR 자재로 한 번에 해결하세요</div>
      </div>
      <a href="#" class="psm2-more">더보기 ›</a>
    </div>
    <div class="psm2-filters">
      <button class="psm2-filter on" type="button">전체</button>
      <button class="psm2-filter" type="button">방수</button>
      <button class="psm2-filter" type="button">코팅</button>
      <button class="psm2-filter" type="button">보수</button>
      <button class="psm2-filter" type="button">단열·차열</button>
      <button class="psm2-filter" type="button">밑칠</button>
    </div>
    <div class="psm2-scroll-wrap">
      <div class="psm2-scroll">
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-m1" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.18)" stroke-width="2"><line x1="0" y1="80" x2="400" y2="80"/><line x1="0" y1="160" x2="400" y2="160"/><line x1="0" y1="240" x2="400" y2="240"/><line x1="0" y1="320" x2="400" y2="320"/></g><rect x="80" y="120" width="240" height="160" rx="6" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.3)" stroke-width="2"/><circle cx="200" cy="200" r="36" fill="rgba(232,120,15,.85)"/><text x="200" y="208" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Pretendard">방수</text></svg><span class="psm2-card-tag">방수</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">옥상 누수 패키지</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">옥상 누수 한 번에 — 방수 풀패키지</div><div class="psm2-card-price"><span class="disc">35%</span><span class="now">189,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-m2" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.1)"><rect x="20" y="20" width="170" height="170" rx="8"/><rect x="210" y="20" width="170" height="170" rx="8"/><rect x="20" y="210" width="170" height="170" rx="8"/><rect x="210" y="210" width="170" height="170" rx="8"/></g><circle cx="200" cy="200" r="48" fill="rgba(15,31,92,.85)"/><text x="200" y="210" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Pretendard">코팅</text></svg><span class="psm2-card-tag" style="background:rgba(15,31,92,.92);">코팅</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">지붕 햇빛 코팅</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">햇빛 차단 코팅 — 옥상 온도 -15℃</div><div class="psm2-card-price"><span class="disc">28%</span><span class="now">142,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-m3" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><path d="M50 320 L130 180 L200 250 L300 100 L380 240 L380 380 L50 380 Z" fill="rgba(255,255,255,.18)"/><circle cx="280" cy="120" r="40" fill="rgba(232,120,15,.7)"/><text x="200" y="350" text-anchor="middle" fill="#fff" font-size="20" font-weight="800" font-family="Pretendard">보수</text></svg><span class="psm2-card-tag">보수</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">박락 복구재</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">철근 노출·박락 복구 — 망치질에도 안 깨짐</div><div class="psm2-card-price"><span class="disc">22%</span><span class="now">96,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-m4" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.18)"><circle cx="100" cy="100" r="50"/><circle cx="300" cy="100" r="50"/><circle cx="100" cy="300" r="50"/><circle cx="300" cy="300" r="50"/><circle cx="200" cy="200" r="80" fill="rgba(255,255,255,.28)"/></g><text x="200" y="212" text-anchor="middle" fill="#fff" font-size="26" font-weight="900" font-family="Pretendard">PKG</text></svg><span class="psm2-card-tag">패키지</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">올인원 키트</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">철재 누수+코팅+보수 올인원 패키지</div><div class="psm2-card-price"><span class="disc">40%</span><span class="now">259,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-m5" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.25)" stroke-width="3" fill="none"><path d="M40 60 Q200 40 360 60"/><path d="M40 120 Q200 100 360 120"/><path d="M40 180 Q200 160 360 180"/><path d="M40 240 Q200 220 360 240"/><path d="M40 300 Q200 280 360 300"/></g><circle cx="200" cy="200" r="42" fill="rgba(232,120,15,.95)"/><text x="200" y="210" text-anchor="middle" fill="#fff" font-size="20" font-weight="800" font-family="Pretendard">단열</text></svg><span class="psm2-card-tag">단열·차열</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">단열 페인트</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">옥상 단열·차열 페인트 — 여름 -15℃</div><div class="psm2-card-price"><span class="disc">25%</span><span class="now">118,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-m6" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.13)"><rect x="60" y="60" width="280" height="280" rx="20"/></g><g fill="rgba(255,255,255,.22)"><rect x="100" y="100" width="200" height="60" rx="6"/><rect x="100" y="170" width="200" height="60" rx="6"/><rect x="100" y="240" width="200" height="60" rx="6"/></g><text x="200" y="358" text-anchor="middle" fill="rgba(232,120,15,.95)" font-size="18" font-weight="800" font-family="Pretendard">HOOKER</text></svg><span class="psm2-card-tag">보수</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">탈락 방지 키트</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">지붕 마감재 탈락 방지 보강 키트</div><div class="psm2-card-price"><span class="disc">18%</span><span class="now">76,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-m7" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.18)"><polygon points="200,40 360,360 40,360"/></g><circle cx="200" cy="240" r="48" fill="rgba(15,31,92,.85)"/><text x="200" y="250" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Pretendard">HOT</text></svg><span class="psm2-card-tag" style="background:#DC2626;">BEST</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">초고탄성 퍼티</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">초고탄성 퍼티 — 미세 균열까지 한 번에</div><div class="psm2-card-price"><span class="disc">30%</span><span class="now">68,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-m8" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.2)" stroke-width="2" fill="none"><path d="M40 200 L160 80 L240 200 L360 80"/><path d="M40 320 L160 200 L240 320 L360 200"/></g><rect x="150" y="160" width="100" height="100" rx="8" fill="rgba(232,120,15,.85)"/><text x="200" y="218" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" font-family="Pretendard">하도</text></svg><span class="psm2-card-tag">밑칠</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">표면 강화제</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">노후 철재 표면 강화 — 처음 칠하기 전에</div><div class="psm2-card-price"><span class="disc">15%</span><span class="now">54,000원</span></div></div></div>
      </div>
      <button class="psm2-arrow prev" type="button" aria-label="이전" data-psm2-scroll="prev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button class="psm2-arrow next" type="button" aria-label="다음" data-psm2-scroll="next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div>
  </div>

  <!-- ===== 그룹 2: 목재 ===== -->
  <div class="psm2-group" data-material="목재">
    <div class="psm2-head">
      <div class="psm2-title-wrap">
        <div class="psm2-title">목재를 고치고 싶다면?</div>
        <div class="psm2-subtitle">갈라짐·변색·습기까지 — POUR 자재로 한 번에 해결하세요</div>
      </div>
      <a href="#" class="psm2-more">더보기 ›</a>
    </div>
    <div class="psm2-filters">
      <button class="psm2-filter on" type="button">전체</button>
      <button class="psm2-filter" type="button">페인트</button>
      <button class="psm2-filter" type="button">코팅</button>
      <button class="psm2-filter" type="button">방수</button>
      <button class="psm2-filter" type="button">보수</button>
      <button class="psm2-filter" type="button">마감·오일</button>
      <button class="psm2-filter" type="button">밑칠</button>
    </div>
    <div class="psm2-scroll-wrap">
      <div class="psm2-scroll">
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-w1" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.18)" stroke-width="3" fill="none"><path d="M0 80 Q100 60 200 80 T400 80"/><path d="M0 160 Q100 140 200 160 T400 160"/><path d="M0 240 Q100 220 200 240 T400 240"/><path d="M0 320 Q100 300 200 320 T400 320"/></g><circle cx="200" cy="200" r="44" fill="rgba(232,120,15,.92)"/><text x="200" y="210" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Pretendard">페인트</text></svg><span class="psm2-card-tag">페인트</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">친환경 수성</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">친환경 수성 목재 페인트 — 무취·저VOC</div><div class="psm2-card-price"><span class="disc">30%</span><span class="now">45,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-w2" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.15)"><rect x="30" y="40" width="340" height="60" rx="4"/><rect x="30" y="120" width="340" height="60" rx="4"/><rect x="30" y="200" width="340" height="60" rx="4"/><rect x="30" y="280" width="340" height="60" rx="4"/></g><circle cx="320" cy="320" r="44" fill="rgba(232,120,15,.9)"/><text x="320" y="330" text-anchor="middle" fill="#fff" font-size="16" font-weight="800" font-family="Pretendard">UV</text></svg><span class="psm2-card-tag" style="background:rgba(15,31,92,.92);">코팅</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">우드 클리어</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">우드 클리어 코팅 — UV 차단·황변 방지</div><div class="psm2-card-price"><span class="disc">25%</span><span class="now">38,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-w3" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none"><path d="M40 100 Q200 80 360 100 Q200 120 40 100"/><path d="M40 180 Q200 160 360 180 Q200 200 40 180"/><path d="M40 260 Q200 240 360 260 Q200 280 40 260"/></g><g fill="rgba(255,255,255,.2)"><circle cx="320" cy="100" r="8"/><circle cx="80" cy="180" r="8"/><circle cx="200" cy="260" r="8"/></g><circle cx="200" cy="200" r="44" fill="rgba(232,120,15,.92)"/><text x="200" y="210" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Pretendard">방수</text></svg><span class="psm2-card-tag">방수</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">데크·바닥</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">데크·바닥 목재 방수 — 빗물·습기 차단</div><div class="psm2-card-price"><span class="disc">22%</span><span class="now">56,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-w4" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.18)"><circle cx="100" cy="100" r="50"/><circle cx="300" cy="100" r="50"/><circle cx="100" cy="300" r="50"/><circle cx="300" cy="300" r="50"/><circle cx="200" cy="200" r="80" fill="rgba(255,255,255,.28)"/></g><text x="200" y="212" text-anchor="middle" fill="#fff" font-size="26" font-weight="900" font-family="Pretendard">PKG</text></svg><span class="psm2-card-tag">패키지</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">우드 토탈</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">우드 토탈 케어 패키지 — 페인트+코팅+오일</div><div class="psm2-card-price"><span class="disc">40%</span><span class="now">89,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-w5" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.25)" stroke-width="3" fill="none"><line x1="0" y1="100" x2="400" y2="120"/><line x1="0" y1="180" x2="400" y2="200"/><line x1="0" y1="260" x2="400" y2="280"/></g><g fill="rgba(232,120,15,.55)"><path d="M150 150 L250 150 L260 250 L140 250 Z"/></g><text x="200" y="210" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" font-family="Pretendard">보수</text></svg><span class="psm2-card-tag">보수</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">갈라짐 보수</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">목재 갈라짐 보수 키트 — 컬러 매칭 가능</div><div class="psm2-card-price"><span class="disc">18%</span><span class="now">32,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-w6" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.2)"><ellipse cx="200" cy="200" rx="160" ry="120"/></g><g fill="rgba(232,120,15,.7)"><circle cx="200" cy="200" r="56"/></g><text x="200" y="212" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Pretendard">OIL</text></svg><span class="psm2-card-tag">마감·오일</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">천연 오일</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">천연 오일 마감 — 무광·반광 선택 가능</div><div class="psm2-card-price"><span class="disc">35%</span><span class="now">28,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-w7" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.18)"><polygon points="200,40 360,360 40,360"/></g><circle cx="200" cy="240" r="48" fill="rgba(232,120,15,.95)"/><text x="200" y="250" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Pretendard">HOT</text></svg><span class="psm2-card-tag" style="background:#DC2626;">BEST</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">외부 목재</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">외부 목재 페인트 — 자외선·곰팡이 방지</div><div class="psm2-card-price"><span class="disc">28%</span><span class="now">52,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-w8" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.2)" stroke-width="2" fill="none"><path d="M40 200 L160 80 L240 200 L360 80"/><path d="M40 320 L160 200 L240 320 L360 200"/></g><rect x="150" y="160" width="100" height="100" rx="8" fill="rgba(232,120,15,.85)"/><text x="200" y="218" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" font-family="Pretendard">하도</text></svg><span class="psm2-card-tag">밑칠</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">목재 프라이머</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">목재 밑칠용 — 페인트 더 잘 묻고 오래가게</div><div class="psm2-card-price"><span class="disc">15%</span><span class="now">24,000원</span></div></div></div>
      </div>
      <button class="psm2-arrow prev" type="button" aria-label="이전" data-psm2-scroll="prev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button class="psm2-arrow next" type="button" aria-label="다음" data-psm2-scroll="next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div>
  </div>

  <!-- ===== 그룹 3: 돌·시멘트 ===== -->
  <div class="psm2-group" data-material="돌·시멘트">
    <div class="psm2-head">
      <div class="psm2-title-wrap">
        <div class="psm2-title">돌·시멘트를 고치고 싶다면?</div>
        <div class="psm2-subtitle">균열·박락·백화까지 — POUR 자재로 한 번에 해결하세요</div>
      </div>
      <a href="#" class="psm2-more">더보기 ›</a>
    </div>
    <div class="psm2-filters">
      <button class="psm2-filter on" type="button">전체</button>
      <button class="psm2-filter" type="button">방수</button>
      <button class="psm2-filter" type="button">코팅</button>
      <button class="psm2-filter" type="button">보수</button>
      <button class="psm2-filter" type="button">균열·갈라짐</button>
      <button class="psm2-filter" type="button">단열·차열</button>
      <button class="psm2-filter" type="button">밑칠</button>
    </div>
    <div class="psm2-scroll-wrap">
      <div class="psm2-scroll">
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-c1" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.13)"><rect x="0" y="0" width="120" height="120"/><rect x="140" y="0" width="120" height="120"/><rect x="280" y="0" width="120" height="120"/><rect x="0" y="140" width="120" height="120"/><rect x="280" y="140" width="120" height="120"/><rect x="0" y="280" width="120" height="120"/><rect x="140" y="280" width="120" height="120"/><rect x="280" y="280" width="120" height="120"/></g><circle cx="200" cy="200" r="56" fill="rgba(232,120,15,.92)"/><text x="200" y="212" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Pretendard">PVC</text></svg><span class="psm2-card-tag">방수</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">지하 방수</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">지하 누수 방수 — 국가 신기술 인증</div><div class="psm2-card-price"><span class="disc">35%</span><span class="now">142,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-c2" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.25)" stroke-width="2"><line x1="0" y1="100" x2="400" y2="120"/><line x1="0" y1="200" x2="400" y2="220"/><line x1="0" y1="300" x2="400" y2="280"/></g><g fill="rgba(255,255,255,.15)"><polygon points="50,80 150,90 140,180 60,170"/><polygon points="200,110 300,100 320,210 220,200"/><polygon points="80,230 180,240 200,330 90,320"/></g><circle cx="320" cy="320" r="44" fill="rgba(15,31,92,.85)"/><text x="320" y="330" text-anchor="middle" fill="#fff" font-size="16" font-weight="800" font-family="Pretendard">코팅</text></svg><span class="psm2-card-tag" style="background:rgba(15,31,92,.92);">코팅</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">표면 강화 코팅</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">콘크리트 표면 강화 코팅 — 노후화 방지</div><div class="psm2-card-price"><span class="disc">28%</span><span class="now">88,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-c3" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.3)" stroke-width="3" fill="none"><path d="M40 200 L120 180 L160 230 L240 190 L290 250 L360 220"/><path d="M60 280 L140 260 L180 310 L260 270 L310 320 L380 290"/></g><circle cx="200" cy="120" r="38" fill="rgba(232,120,15,.85)"/><text x="200" y="130" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" font-family="Pretendard">보수</text></svg><span class="psm2-card-tag">보수</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">단면 메움 복구</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">철근 노출·박락 복구 — 메우고 다시 칠하기</div><div class="psm2-card-price"><span class="disc">22%</span><span class="now">54,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-c4" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.6)" stroke-width="4" fill="none"><path d="M100 50 L130 130 L100 200 L150 270 L120 360"/><path d="M250 50 L220 130 L280 200 L240 270 L290 360"/></g><circle cx="200" cy="200" r="48" fill="rgba(232,120,15,.92)"/><text x="200" y="210" text-anchor="middle" fill="#fff" font-size="20" font-weight="800" font-family="Pretendard">크랙</text></svg><span class="psm2-card-tag">균열·갈라짐</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">균열 보수 시트</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">외벽 균열 보수 시트 — 강력 부착·잘 안 찢어짐</div><div class="psm2-card-price"><span class="disc">30%</span><span class="now">76,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-c5" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.22)" stroke-width="3" fill="none"><path d="M40 60 Q200 40 360 60"/><path d="M40 120 Q200 100 360 120"/><path d="M40 180 Q200 160 360 180"/><path d="M40 240 Q200 220 360 240"/><path d="M40 300 Q200 280 360 300"/></g><circle cx="200" cy="200" r="42" fill="rgba(232,120,15,.95)"/><text x="200" y="210" text-anchor="middle" fill="#fff" font-size="20" font-weight="800" font-family="Pretendard">단열</text></svg><span class="psm2-card-tag">단열·차열</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">외벽 단열</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">외벽 단열·차열 코팅 — 햇빛 91% 반사</div><div class="psm2-card-price"><span class="disc">25%</span><span class="now">128,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-c6" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.2)"><circle cx="100" cy="100" r="50"/><circle cx="300" cy="100" r="50"/><circle cx="100" cy="300" r="50"/><circle cx="300" cy="300" r="50"/><circle cx="200" cy="200" r="80" fill="rgba(232,120,15,.55)"/></g><text x="200" y="212" text-anchor="middle" fill="#fff" font-size="26" font-weight="900" font-family="Pretendard">PKG</text></svg><span class="psm2-card-tag" style="background:#DC2626;">BEST</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">외벽 토탈</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">외벽 크랙보수+재도장 토탈 패키지</div><div class="psm2-card-price"><span class="disc">38%</span><span class="now">198,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-c7" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g fill="rgba(255,255,255,.13)"><rect x="50" y="50" width="300" height="300" rx="14"/></g><g fill="rgba(232,120,15,.45)"><rect x="80" y="80" width="240" height="40" rx="4"/><rect x="80" y="135" width="240" height="40" rx="4"/><rect x="80" y="190" width="240" height="40" rx="4"/><rect x="80" y="245" width="240" height="40" rx="4"/><rect x="80" y="300" width="240" height="20" rx="4"/></g><text x="200" y="370" text-anchor="middle" fill="rgba(255,255,255,.7)" font-size="16" font-weight="800" font-family="Pretendard">EPOXY</text></svg><span class="psm2-card-tag" style="background:rgba(15,31,92,.92);">코팅</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">바닥 강화 코팅</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">바닥 강화 코팅 — 차도 다녀도 안 깨짐</div><div class="psm2-card-price"><span class="disc">28%</span><span class="now">96,000원</span></div></div></div>
        <div class="psm2-card"><div class="psm2-card-img"><svg class="thb-c8" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g stroke="rgba(255,255,255,.2)" stroke-width="2" fill="none"><path d="M40 200 L160 80 L240 200 L360 80"/><path d="M40 320 L160 200 L240 320 L360 200"/></g><rect x="150" y="160" width="100" height="100" rx="8" fill="rgba(232,120,15,.85)"/><text x="200" y="218" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" font-family="Pretendard">하도</text></svg><span class="psm2-card-tag">밑칠</span><div class="psm2-card-bottom"><span class="psm2-card-av">P</span><span class="psm2-card-name">표면 강화제</span></div><button class="psm2-card-bookmark" type="button" aria-label="저장"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div><div class="psm2-card-info"><div class="psm2-card-title">노후 콘크리트 표면 강화 — 칠하기 전 필수</div><div class="psm2-card-price"><span class="disc">18%</span><span class="now">64,000원</span></div></div></div>
      </div>
      <button class="psm2-arrow prev" type="button" aria-label="이전" data-psm2-scroll="prev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button class="psm2-arrow next" type="button" aria-label="다음" data-psm2-scroll="next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div>
  </div>

</div>
<script>
(function(){
  var root = document.currentScript && document.currentScript.parentElement;
  if (!root) return;
  // 각 그룹별로 필터 토글·화살표 스크롤을 독립 스코프로 설정
  root.querySelectorAll('.psm2-group').forEach(function(group){
    var scroller = group.querySelector('.psm2-scroll');
    var filters = group.querySelectorAll('.psm2-filter');
    filters.forEach(function(b){
      b.addEventListener('click', function(){
        filters.forEach(function(x){ x.classList.remove('on'); });
        b.classList.add('on');
      });
    });
    group.querySelectorAll('[data-psm2-scroll]').forEach(function(btn){
      btn.addEventListener('click', function(){
        if (!scroller) return;
        var dir = btn.dataset.psm2Scroll === 'next' ? 1 : -1;
        var card = scroller.querySelector('.psm2-card');
        var step = card ? (card.getBoundingClientRect().width + 16) * 2 : 300;
        scroller.scrollBy({ left: dir * step, behavior: 'smooth' });
      });
    });
  });
})();
</script>
</section>`;

  // 메인 3번 섹션 — POUR닥터 진입 퀵배너
  const POUR_DR_QUICK_BANNER_HTML = `<section class="pdq">
<style>
.pdq *, .pdq *::before, .pdq *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pdq { padding:14px 24px 18px; display:flex; justify-content:center; }
.pdq-card { max-width:960px; position:relative; border-radius:32px; background:linear-gradient(135deg,#FFFBF4 0%,#FFEFD8 100%); color:#0F1F5C; padding:24px 32px; display:grid; grid-template-columns:180px auto; gap:24px; align-items:center; border:none; box-shadow:0 18px 44px rgba(232,120,15,.18), 0 4px 12px rgba(15,31,92,.05); cursor:pointer; transition:transform .25s cubic-bezier(.2,.8,.25,1), box-shadow .25s ease; letter-spacing:-0.02em; isolation:isolate; overflow:visible; text-decoration:none; }
.pdq-card:hover { transform:translateY(-2px); box-shadow:0 24px 54px rgba(232,120,15,.24), 0 6px 14px rgba(15,31,92,.06); }
.pdq-card::before { content:''; position:absolute; inset:0; border-radius:32px; pointer-events:none; z-index:0; background:radial-gradient(130% 100% at 97% -8%, rgba(232,120,15,.16) 0%, transparent 48%), radial-gradient(90% 90% at 2% 110%, rgba(244,154,58,.12) 0%, transparent 55%); }
.pdq-card > * { position:relative; z-index:1; }
/* 캐릭터 — 좌측, 수직 중앙, 살짝 떠오르는 움직임 + 은은한 후광 */
.pdq-char { position:relative; align-self:center; margin:0; }
.pdq-char::after { content:''; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:160px; height:160px; border-radius:50%; background:radial-gradient(circle, rgba(244,154,58,.22) 0%, transparent 62%); z-index:-1; animation:pdqHalo 4s ease-in-out infinite; }
@keyframes pdqHalo { 0%,100% { opacity:.55; transform:translate(-50%,-50%) scale(.9); } 50% { opacity:.9; transform:translate(-50%,-50%) scale(1.08); } }
.pdq-char-img { display:block; width:100%; max-width:180px; height:auto; filter:drop-shadow(0 12px 18px rgba(15,31,92,.2)); animation:pdqFloat 3.8s ease-in-out infinite; }
@keyframes pdqFloat { 0%,100% { transform:translateY(0) rotate(-0.6deg); } 50% { transform:translateY(-6px) rotate(0.6deg); } }
.pdq-char-spot { display:none; }
/* 말풍선 — 메시지 + CTA를 한 박스에 담아 통합 (CTA가 따로 놀지 않게) */
.pdq-bubble { position:relative; background:#fff; border:none; border-radius:28px; padding:22px 26px; box-shadow:0 12px 32px rgba(232,120,15,.1), 0 3px 10px rgba(15,31,92,.05); display:flex; align-items:center; gap:26px; }
.pdq-bubble::before { content:''; position:absolute; left:-7px; top:50%; margin-top:-8px; width:16px; height:16px; background:#fff; border-radius:0 0 0 5px; transform:rotate(45deg); }
.pdq-msg { min-width:0; }
.pdq-kicker { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#E8780F; margin-bottom:12px; white-space:nowrap; letter-spacing:0.01em; }
.pdq-dot { width:6px; height:6px; border-radius:50%; background:#10B981; box-shadow:0 0 0 3px rgba(16,185,129,.2); animation:pdqDot 1.7s ease-in-out infinite; flex-shrink:0; }
@keyframes pdqDot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.45; transform:scale(.8); } }
.pdq-headline { font-size:27px; font-weight:800; line-height:1.46; letter-spacing:-0.02em; color:#0F1F5C; word-break:keep-all; }
.pdq-headline b { color:#E8780F; font-weight:800; position:relative; display:inline-block; }
.pdq-headline b::after { content:''; position:absolute; left:-1px; right:-1px; bottom:2px; height:9px; background:rgba(254,210,160,.75); z-index:-1; border-radius:2px; }
.pdq-sub { margin-top:13px; font-size:14px; font-weight:500; color:#5C6675; line-height:1.6; letter-spacing:-0.01em; word-break:keep-all; }
.pdq-sub b { color:#0F1F5C; font-weight:600; }
.pdq-chips { margin-top:16px; display:flex; gap:8px; flex-wrap:wrap; }
.pdq-chip { display:inline-flex; align-items:center; gap:5px; font-size:12.5px; font-weight:600; color:#9A5B1E; background:#FFF2E0; border:none; border-radius:999px; padding:7px 13px; letter-spacing:-0.01em; transition:transform .18s ease, box-shadow .18s ease; }
.pdq-chip b { color:#E8780F; font-weight:700; }
.pdq-card:hover .pdq-chip { transform:translateY(-1px); box-shadow:0 4px 10px rgba(232,120,15,.14); }
/* CTA — 말풍선 우측, 구분선 없이 여백으로만 분리 (부드럽게) */
.pdq-action { position:relative; flex-shrink:0; width:196px; display:flex; flex-direction:column; align-items:stretch; gap:10px; padding-left:28px; }
.pdq-free { align-self:center; display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:800; color:#fff; background:linear-gradient(135deg,#2ED477 0%,#03B95A 100%); padding:5px 12px; border-radius:999px; letter-spacing:0.03em; box-shadow:0 4px 10px rgba(3,185,90,.3); transform-origin:center; animation:pdqFree 3s ease-in-out infinite; }
.pdq-free::before { content:''; width:5px; height:5px; border-radius:50%; background:#fff; animation:pdqDot 1.7s ease-in-out infinite; }
@keyframes pdqFree { 0%,88%,100% { transform:rotate(0deg) scale(1); } 92% { transform:rotate(-5deg) scale(1.06); } 96% { transform:rotate(5deg) scale(1.06); } }
.pdq-cta { position:relative; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:16px 24px; background:linear-gradient(135deg,#F9A94A 0%,#E8780F 100%); color:#fff; font-size:15px; font-weight:800; border:none; border-radius:16px; cursor:pointer; letter-spacing:-0.02em; box-shadow:0 8px 22px rgba(232,120,15,.4); transition:transform .2s ease, box-shadow .2s ease; animation:pdqCtaBreathe 3.4s ease-in-out infinite; overflow:hidden; }
@keyframes pdqCtaBreathe { 0%,100% { box-shadow:0 8px 22px rgba(232,120,15,.4); } 50% { box-shadow:0 10px 30px rgba(232,120,15,.55); } }
.pdq-cta::after { content:''; position:absolute; top:0; left:-60%; width:40%; height:100%; background:linear-gradient(100deg, transparent, rgba(255,255,255,.45), transparent); transform:skewX(-18deg); animation:pdqShine 4.5s ease-in-out infinite; }
@keyframes pdqShine { 0%,72% { left:-60%; } 86%,100% { left:130%; } }
.pdq-card:hover .pdq-cta { transform:translateY(-2px) scale(1.02); box-shadow:0 14px 32px rgba(232,120,15,.5); }
.pdq-cta-arrow { font-size:17px; transition:transform .2s ease; }
.pdq-card:hover .pdq-cta-arrow { transform:translateX(4px); }
.pdq-cta-sub { text-align:center; font-size:12px; font-weight:600; color:#94A3B8; }
@media (prefers-reduced-motion: reduce) {
  .pdq-char-img, .pdq-char::after, .pdq-char-spot, .pdq-cta, .pdq-cta::after, .pdq-free, .pdq-free::before, .pdq-dot { animation:none !important; }
}
/* 태블릿 */
@media (max-width:900px) {
  .pdq-card { grid-template-columns:140px auto; gap:18px; padding:20px 22px; }
  .pdq-char-img { max-width:140px; }
  .pdq-char::after { width:130px; height:130px; }
  .pdq-bubble { gap:16px; padding:16px 18px; }
  .pdq-headline { font-size:21px; }
  .pdq-action { width:156px; padding-left:18px; }
  .pdq-cta { padding:13px 14px; font-size:13.5px; }
  .pdq-cta-arrow { font-size:15px; }
}
/* 모바일 — 마스코트 상단 중앙 + 세로 스택 (모바일 우선 최적화) */
@media (max-width:700px) {
  .pdq { padding:10px 12px 24px; }
  .pdq-card { width:100%; max-width:480px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:0; padding:20px 16px 18px; border-radius:20px; }
  /* 캐릭터 — 상단 중앙, 말풍선 위로 살짝 겹쳐 "말하는" 느낌 */
  .pdq-char { order:1; align-self:center; margin:0 0 -12px; }
  .pdq-char-img { max-width:100px; }
  .pdq-char-spot { display:none; }
  /* 말풍선 — 전체폭 세로(메시지→CTA), 꼬리는 위(캐릭터)를 향함 */
  .pdq-bubble { order:2; width:100%; flex-direction:column; align-items:center; gap:0; padding:28px 18px 20px; border-radius:18px; }
  .pdq-bubble::before { left:50%; top:-8px; width:16px; height:16px; transform:translateX(-50%) rotate(45deg); border-left:1px solid #F6E2C8; border-top:1px solid #F6E2C8; border-bottom:0; }
  .pdq-msg { width:100%; }
  .pdq-kicker { font-size:11.5px; margin-bottom:8px; }
  .pdq-headline { font-size:20px; line-height:1.4; }
  .pdq-headline b::after { height:8px; }
  .pdq-sub { font-size:13px; margin-top:9px; }
  .pdq-chips { margin-top:14px; gap:7px; justify-content:center; }
  .pdq-chip { font-size:12px; padding:6px 12px; }
  /* CTA — 말풍선 하단, 구분선으로 분리 */
  .pdq-action { width:100%; flex-direction:column; align-items:center; gap:10px; padding-left:0; margin-top:14px; padding-top:0; }
  .pdq-free { align-self:center; }
  .pdq-cta { width:100%; padding:15px 18px; font-size:15px; }
}
/* 초소형 (≤380px) — 폰트·여백 추가 축소 */
@media (max-width:380px) {
  .pdq-char-img { max-width:88px; }
  .pdq-headline { font-size:18px; }
  .pdq-chips { gap:6px; }
  .pdq-chip { font-size:11.5px; padding:5px 10px; }
}
</style>
<a class="pdq-card" href="./pour-doctor.html">
  <div class="pdq-char">
    <div class="pdq-char-spot"></div>
    <img class="pdq-char-img" src="https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/%EB%A7%88%EC%8A%A4%EC%BD%94%ED%8A%B8%2Fbeaver_quickbanner_gown_circle_noborder.png?alt=media&token=1b20bea5-1fde-44aa-87bd-18a116b1eeee" alt="POUR닥터" loading="lazy"/>
  </div>
  <div class="pdq-bubble">
    <div class="pdq-msg">
      <span class="pdq-kicker"><span class="pdq-dot"></span>POUR닥터 · 1:1 무료 진단</span>
      <div class="pdq-headline">건물에 어려움이 있다면,<br/><b>편하게 말씀해 주세요!</b></div>
      <div class="pdq-sub">사진 한 장이면 <b>R&D 박사</b>가 직접 답해드려요.</div>
      <div class="pdq-chips">
        <span class="pdq-chip">🩺 박사 직접 답변</span>
        <span class="pdq-chip">⏱ 평균 응답 <b>3분</b></span>
      </div>
    </div>
    <div class="pdq-action">
      <span class="pdq-free">FREE</span>
      <button class="pdq-cta" type="button">지금 말씀하기 <span class="pdq-cta-arrow">→</span></button>
      <span class="pdq-cta-sub">사진만 첨부하면 끝</span>
    </div>
  </div>
</a>
</section>`;

  // POUR닥터 — 플로팅 진단 FAB (전체 시안 우하단에 항상 떠있는 퀵 진입 버튼)
  const POUR_DR_FAB_HTML = `<section class="pdfab" aria-label="POUR닥터 빠른 진단">
<style>
.pdfab *, .pdfab *::before, .pdfab *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pdfab { all:unset; }
.pdfab-wrap { position:fixed; right:24px; bottom:24px; z-index:9999; display:flex; flex-direction:column; align-items:flex-end; gap:10px; pointer-events:none; }
.pdfab-wrap > * { pointer-events:auto; }
/* 작은 툴팁 (펄스 신호) */
.pdfab-tip { background:#fff; border:1px solid #F2F3F5; border-radius:14px; padding:12px 16px; box-shadow:0 8px 28px rgba(15,31,92,.18); display:flex; align-items:center; gap:10px; opacity:0; transform:translateY(8px); animation:pdfabSlide .4s ease .8s forwards; max-width:280px; }
@keyframes pdfabSlide { to { opacity:1; transform:translateY(0); } }
.pdfab-tip-close { width:22px; height:22px; border-radius:50%; background:#F3F4F6; color:#6B7280; border:none; cursor:pointer; font-size:13px; display:grid; place-items:center; flex-shrink:0; transition:.15s; }
.pdfab-tip-close:hover { background:#E5E7EB; color:#111; }
.pdfab-tip-text { font-size:13px; font-weight:600; color:#2F3438; letter-spacing:-0.03em; line-height:1.4; }
.pdfab-tip-text b { color:#E8780F; font-weight:800; }
.pdfab-tip.hidden { display:none; }
/* 메인 버튼 */
.pdfab-btn { display:inline-flex; align-items:center; gap:10px; padding:14px 22px 14px 14px; background:linear-gradient(135deg,#F49A3A 0%,#E8780F 100%); color:#fff; border-radius:999px; text-decoration:none; box-shadow:0 12px 32px rgba(232,120,15,.4), 0 4px 12px rgba(15,31,92,.12); border:none; cursor:pointer; font-size:14.5px; font-weight:800; letter-spacing:-0.03em; transition:.18s; position:relative; }
.pdfab-btn:hover { transform:translateY(-3px); box-shadow:0 18px 40px rgba(232,120,15,.5), 0 6px 16px rgba(15,31,92,.18); }
.pdfab-btn:active { transform:translateY(-1px); }
.pdfab-ico { width:42px; height:42px; border-radius:50%; background:#fff; display:grid; place-items:center; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.18), inset 0 0 0 2px rgba(255,255,255,.95); }
.pdfab-ico img { width:100%; height:100%; object-fit:cover; object-position:center 22%; display:block; }
.pdfab-ico svg { width:22px; height:22px; color:#E8780F; }
.pdfab-text-wrap { display:flex; flex-direction:column; gap:1px; align-items:flex-start; line-height:1.2; padding-right:4px; }
.pdfab-text-top { font-size:10.5px; font-weight:700; color:rgba(255,255,255,.85); letter-spacing:0.04em; text-transform:uppercase; }
.pdfab-text-bot { font-size:14px; font-weight:800; letter-spacing:-0.03em; }
/* 펄스 링 */
.pdfab-ring { position:absolute; inset:-6px; border-radius:999px; border:2px solid rgba(232,120,15,.6); animation:pdfabRing 2.2s ease-out infinite; pointer-events:none; }
@keyframes pdfabRing { 0% { opacity:.8; transform:scale(.95); } 100% { opacity:0; transform:scale(1.18); } }
.pdfab-live { position:absolute; top:-2px; right:-2px; width:14px; height:14px; border-radius:50%; background:#10B981; border:3px solid #fff; box-shadow:0 0 0 0 rgba(16,185,129,.6); animation:pdfabLivePulse 1.6s ease-in-out infinite; }
@keyframes pdfabLivePulse { 0% { box-shadow:0 0 0 0 rgba(16,185,129,.6); } 70% { box-shadow:0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow:0 0 0 0 rgba(16,185,129,0); } }
@media (max-width:700px) {
  .pdfab-wrap { right:16px; bottom:16px; gap:8px; }
  .pdfab-tip { padding:10px 14px; max-width:240px; }
  .pdfab-tip-text { font-size:12px; }
  .pdfab-btn { padding:12px 18px 12px 12px; font-size:13.5px; }
  .pdfab-ico { width:36px; height:36px; }
  .pdfab-ico svg { width:20px; height:20px; }
  .pdfab-text-top { font-size:9.5px; }
  .pdfab-text-bot { font-size:13px; }
}
</style>
<div class="pdfab-wrap">
  <div class="pdfab-tip" id="pdfabTip">
    <span class="pdfab-tip-text">증상만 알려주세요 — <b>3분 안에</b> 처방서 받아보세요 🩺</span>
    <button class="pdfab-tip-close" type="button" aria-label="알림 닫기" onclick="this.parentElement.classList.add('hidden')">✕</button>
  </div>
  <a class="pdfab-btn" href="./pour-doctor.html" aria-label="POUR닥터 무료 진단">
    <span class="pdfab-ring"></span>
    <span class="pdfab-ico">
      <img src="https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/%EB%A7%88%EC%8A%A4%EC%BD%94%ED%8A%B8%2Fbeaver_doctor_gown.png?alt=media&token=7a037402-fe11-46fc-b66c-3f8226aabd86" alt="POUR닥터" loading="lazy"/>
    </span>
    <span class="pdfab-text-wrap">
      <span class="pdfab-text-top">POUR DOCTOR</span>
      <span class="pdfab-text-bot">무료 진단</span>
    </span>
    <span class="pdfab-live" aria-hidden="true"></span>
  </a>
</div>
</section>`;

  // POUR닥터 페이지 — 히어로
  const POUR_DR_HERO_HTML = `<section class="pdh">
<style>
.pdh *, .pdh *::before, .pdh *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pdh { background:radial-gradient(ellipse at top right, rgba(232,120,15,.08) 0%, transparent 50%),linear-gradient(180deg,#0A1742 0%,#0F1F5C 60%,#1E3A8A 100%); padding:72px 24px 80px; color:#fff; letter-spacing:-0.02em; position:relative; overflow:hidden; }
.pdh::before { content:''; position:absolute; top:-200px; left:-100px; width:600px; height:600px; background:radial-gradient(circle, rgba(232,120,15,.14) 0%, transparent 60%); pointer-events:none; }
.pdh::after { content:''; position:absolute; bottom:-150px; right:-80px; width:520px; height:520px; background:radial-gradient(circle, rgba(96,165,250,.12) 0%, transparent 65%); pointer-events:none; }
.pdh-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1.15fr 1fr; gap:48px; align-items:center; position:relative; z-index:1; }
.pdh-kicker { display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; color:#FED7AA; letter-spacing:0.02em; padding:6px 14px; background:rgba(232,120,15,.18); border:1px solid rgba(232,120,15,.32); border-radius:999px; margin-bottom:20px; }
.pdh-kicker-dot { width:7px; height:7px; border-radius:50%; background:#10B981; box-shadow:0 0 0 4px rgba(16,185,129,.22); }
.pdh-title { font-size:46px; font-weight:900; line-height:1.18; letter-spacing:-0.045em; }
.pdh-title b { color:#FED7AA; }
.pdh-title .pdh-accent { background:linear-gradient(120deg,#F49A3A,#FED7AA); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.pdh-sub { margin-top:18px; font-size:16px; font-weight:500; color:rgba(255,255,255,.78); line-height:1.7; letter-spacing:-0.02em; }
.pdh-sub b { color:#fff; font-weight:700; }
.pdh-cta { margin-top:30px; display:flex; gap:10px; flex-wrap:wrap; }
.pdh-btn-primary { padding:14px 26px; background:#E8780F; color:#fff; border-radius:999px; border:none; font-size:14.5px; font-weight:700; cursor:pointer; letter-spacing:-0.03em; box-shadow:0 8px 20px rgba(232,120,15,.4); transition:.15s; }
.pdh-btn-primary:hover { background:#C8650D; transform:translateY(-1px); }
.pdh-btn-ghost { padding:14px 24px; background:rgba(255,255,255,.08); color:#fff; border-radius:999px; border:1px solid rgba(255,255,255,.2); font-size:14.5px; font-weight:600; cursor:pointer; letter-spacing:-0.03em; transition:.15s; }
.pdh-btn-ghost:hover { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.3); }
.pdh-trust { margin-top:34px; display:flex; gap:24px; flex-wrap:wrap; align-items:center; padding-top:24px; border-top:1px solid rgba(255,255,255,.12); }
.pdh-trust-item { display:flex; flex-direction:column; }
.pdh-trust-num { font-size:24px; font-weight:900; color:#FED7AA; letter-spacing:-0.04em; line-height:1; }
.pdh-trust-label { margin-top:4px; font-size:11.5px; font-weight:600; color:rgba(255,255,255,.65); letter-spacing:-0.02em; }
/* 우측 진단 카드 (라이브 디스플레이 분위기) */
.pdh-display { background:linear-gradient(160deg,rgba(255,255,255,.08) 0%,rgba(255,255,255,.04) 100%); border:1px solid rgba(255,255,255,.14); border-radius:20px; padding:24px; backdrop-filter:blur(20px); box-shadow:0 20px 60px rgba(0,0,0,.25); }
.pdh-display-head { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
.pdh-display-dot { display:flex; gap:5px; }
.pdh-display-dot span { width:10px; height:10px; border-radius:50%; }
.pdh-display-dot span:nth-child(1) { background:#EF4444; }
.pdh-display-dot span:nth-child(2) { background:#F59E0B; }
.pdh-display-dot span:nth-child(3) { background:#10B981; }
.pdh-display-title { font-size:12.5px; font-weight:700; color:rgba(255,255,255,.7); letter-spacing:-0.02em; }
.pdh-display-live { margin-left:auto; display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:700; color:#10B981; letter-spacing:0.04em; padding:3px 9px; background:rgba(16,185,129,.14); border-radius:999px; }
.pdh-display-live::before { content:''; width:6px; height:6px; border-radius:50%; background:#10B981; animation:pdhPulse 1.5s ease infinite; }
@keyframes pdhPulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
.pdh-display-body { display:flex; flex-direction:column; gap:12px; }
.pdh-display-row { display:flex; gap:12px; align-items:center; padding:14px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:12px; }
.pdh-display-row-ico { width:38px; height:38px; border-radius:10px; background:rgba(232,120,15,.18); display:grid; place-items:center; flex-shrink:0; font-size:18px; }
.pdh-display-row-text { flex:1; min-width:0; }
.pdh-display-row-name { font-size:12.5px; font-weight:700; color:#fff; letter-spacing:-0.02em; }
.pdh-display-row-meta { margin-top:2px; font-size:11px; font-weight:500; color:rgba(255,255,255,.55); letter-spacing:-0.02em; }
.pdh-display-row-tag { font-size:10.5px; font-weight:800; padding:4px 9px; border-radius:6px; letter-spacing:-0.02em; }
.pdh-display-row-tag.ok { background:rgba(16,185,129,.18); color:#6EE7B7; }
.pdh-display-row-tag.warn { background:rgba(245,158,11,.18); color:#FCD34D; }
.pdh-display-row-tag.crit { background:rgba(239,68,68,.18); color:#FCA5A5; }
.pdh-display-foot { margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,.1); display:flex; justify-content:space-between; align-items:center; }
.pdh-display-foot-label { font-size:10.5px; font-weight:600; color:rgba(255,255,255,.55); letter-spacing:-0.02em; }
.pdh-display-foot-val { font-size:13px; font-weight:800; color:#FED7AA; letter-spacing:-0.02em; }
@media (max-width:900px) {
  .pdh-inner { grid-template-columns:1fr; gap:32px; }
}
@media (max-width:700px) {
  .pdh { padding:48px 16px 56px; }
  .pdh-title { font-size:30px; }
  .pdh-sub { font-size:14px; }
  .pdh-trust-num { font-size:20px; }
  .pdh-trust { gap:18px; }
}
</style>
<div class="pdh-inner">
  <div class="pdh-text">
    <span class="pdh-kicker"><span class="pdh-kicker-dot"></span>POUR스토어만의 1:1 진단 서비스</span>
    <h1 class="pdh-title">당신만의<br/>건물 <span class="pdh-accent">닥터</span>가<br/>여기 있습니다.</h1>
    <p class="pdh-sub">사진 한 장이면 <b>R&D 박사·전문 시공팀·AI 분석가</b>가 함께 진단합니다.<br/>방수·도장·보수 <b>50+ 특허</b>와 <b>240만 세대 빅데이터</b>로 <b>처방서 + 시공 매칭</b>까지 — 한 번에.</p>
    <div class="pdh-cta">
      <button class="pdh-btn-primary" type="button">🩺 무료 진단 시작</button>
      <button class="pdh-btn-ghost" type="button">서비스 더 알아보기</button>
    </div>
    <div class="pdh-trust">
      <div class="pdh-trust-item"><span class="pdh-trust-num">2.4M+</span><span class="pdh-trust-label">누적 진단 세대</span></div>
      <div class="pdh-trust-item"><span class="pdh-trust-num">50+</span><span class="pdh-trust-label">자체 특허·기술</span></div>
      <div class="pdh-trust-item"><span class="pdh-trust-num">700+</span><span class="pdh-trust-label">진단한 단지</span></div>
      <div class="pdh-trust-item"><span class="pdh-trust-num">250+</span><span class="pdh-trust-label">전국 시공 파트너</span></div>
      <div class="pdh-trust-item"><span class="pdh-trust-num">3분</span><span class="pdh-trust-label">평균 응답</span></div>
    </div>
  </div>
  <div class="pdh-display">
    <div class="pdh-display-head">
      <div class="pdh-display-dot"><span></span><span></span><span></span></div>
      <span class="pdh-display-title">POUR Doctor — 실시간 진단 보드</span>
      <span class="pdh-display-live">LIVE</span>
    </div>
    <div class="pdh-display-body">
      <div class="pdh-display-row">
        <div class="pdh-display-row-ico">🏢</div>
        <div class="pdh-display-row-text"><div class="pdh-display-row-name">○○아파트 옥상 누수</div><div class="pdh-display-row-meta">202동 · 옥상 방수 패키지 추천 · 2026.05.16 09:24</div></div>
        <span class="pdh-display-row-tag ok">처방완료</span>
      </div>
      <div class="pdh-display-row">
        <div class="pdh-display-row-ico">🏭</div>
        <div class="pdh-display-row-text"><div class="pdh-display-row-name">○○공장 외벽 균열</div><div class="pdh-display-row-meta">남측 벽체 · 균열 보수 + 재도장 매칭 중 · 2026.05.16 09:18</div></div>
        <span class="pdh-display-row-tag warn">시공매칭</span>
      </div>
      <div class="pdh-display-row">
        <div class="pdh-display-row-ico">🏪</div>
        <div class="pdh-display-row-text"><div class="pdh-display-row-name">○○상가 지하 누수</div><div class="pdh-display-row-meta">B1 주차장 · 지하 누수 긴급 처방 · 2026.05.16 09:12</div></div>
        <span class="pdh-display-row-tag crit">긴급</span>
      </div>
      <div class="pdh-display-row">
        <div class="pdh-display-row-ico">🏠</div>
        <div class="pdh-display-row-text"><div class="pdh-display-row-name">○○빌라 지붕 슁글</div><div class="pdh-display-row-meta">탈락 위험 · 슁글 탈락 방지 보강 추천 · 2026.05.16 09:05</div></div>
        <span class="pdh-display-row-tag ok">처방완료</span>
      </div>
    </div>
    <div class="pdh-display-foot">
      <span class="pdh-display-foot-label">오늘 진단 건수 · 시공 매칭 완료</span>
      <span class="pdh-display-foot-val">23건 · 14건</span>
    </div>
  </div>
</div>
</section>`;

  // POUR닥터 페이지 — 4단계 케어 프로세스
  const POUR_DR_PROCESS_HTML = `<section class="pdp">
<style>
.pdp *, .pdp *::before, .pdp *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pdp { background:#F9FAFB; padding:80px 24px; color:#2F3438; letter-spacing:-0.02em; }
.pdp-inner { max-width:1200px; margin:0 auto; }
.pdp-head { text-align:center; margin-bottom:48px; }
.pdp-kicker { display:inline-block; font-size:12.5px; font-weight:700; color:#E8780F; letter-spacing:0.04em; padding:5px 14px; background:#FFF7ED; border:1px solid #FED7AA; border-radius:999px; margin-bottom:14px; }
.pdp-title { font-size:36px; font-weight:900; color:#111111; letter-spacing:-0.045em; line-height:1.25; }
.pdp-title b { color:#E8780F; }
.pdp-sub { margin-top:14px; font-size:16px; font-weight:500; color:#6B7280; letter-spacing:-0.02em; line-height:1.65; }
.pdp-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; position:relative; }
.pdp-steps::before { content:''; position:absolute; top:38px; left:8%; right:8%; height:2px; background:repeating-linear-gradient(90deg,#FED7AA 0,#FED7AA 6px,transparent 6px,transparent 12px); z-index:0; }
.pdp-step { position:relative; background:#fff; border:1px solid #F2F3F5; border-radius:18px; padding:28px 22px; transition:.18s; z-index:1; }
.pdp-step:hover { border-color:#E8780F; transform:translateY(-3px); box-shadow:0 12px 32px rgba(15,31,92,.08); }
.pdp-step-num { width:56px; height:56px; border-radius:18px; background:linear-gradient(135deg,#F49A3A,#E8780F); color:#fff; display:grid; place-items:center; font-size:22px; font-weight:900; letter-spacing:-0.04em; box-shadow:0 8px 20px rgba(232,120,15,.32); margin:0 auto 16px; }
.pdp-step-name { font-size:18px; font-weight:800; color:#111111; letter-spacing:-0.04em; text-align:center; margin-bottom:8px; }
.pdp-step-desc { font-size:13px; font-weight:500; color:#6B7280; letter-spacing:-0.02em; line-height:1.6; text-align:center; margin-bottom:16px; }
.pdp-step-list { display:flex; flex-direction:column; gap:8px; padding-top:14px; border-top:1px solid #F2F3F5; }
.pdp-step-list-item { display:flex; gap:8px; align-items:flex-start; font-size:12px; font-weight:600; color:#374151; letter-spacing:-0.02em; line-height:1.5; }
.pdp-step-list-item::before { content:'✓'; color:#10B981; font-weight:900; flex-shrink:0; }
.pdp-step-time { margin-top:14px; display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:#E8780F; background:#FFF7ED; padding:4px 10px; border-radius:6px; letter-spacing:-0.02em; }
.pdp-cmp { margin-top:60px; padding:32px; background:#fff; border-radius:18px; border:1px solid #F2F3F5; }
.pdp-cmp-title { font-size:18px; font-weight:800; color:#111; letter-spacing:-0.04em; margin-bottom:18px; text-align:center; }
.pdp-cmp-title b { color:#E8780F; }
.pdp-cmp-grid { display:grid; grid-template-columns:1.2fr 1fr 1fr; gap:1px; background:#F2F3F5; border-radius:12px; overflow:hidden; border:1px solid #F2F3F5; }
.pdp-cmp-cell { padding:14px 16px; background:#fff; font-size:13px; font-weight:600; color:#374151; letter-spacing:-0.02em; display:flex; align-items:center; gap:6px; }
.pdp-cmp-cell.h { background:#FAFAFA; font-weight:800; color:#111; font-size:13.5px; }
.pdp-cmp-cell.h.us { background:#FFF7ED; color:#E8780F; }
.pdp-cmp-cell.us { background:#FFFBF5; color:#111; font-weight:700; }
.pdp-cmp-cell .ok { color:#10B981; font-weight:800; }
.pdp-cmp-cell .no { color:#9CA3AF; font-weight:600; }
@media (max-width:900px) {
  .pdp-steps { grid-template-columns:repeat(2,1fr); }
  .pdp-steps::before { display:none; }
}
@media (max-width:700px) {
  .pdp { padding:56px 16px; }
  .pdp-title { font-size:28px; }
  .pdp-sub { font-size:14px; }
  .pdp-steps { grid-template-columns:1fr; gap:14px; }
  .pdp-cmp { padding:20px; margin-top:40px; }
  .pdp-cmp-grid { grid-template-columns:1fr; }
  .pdp-cmp-cell { padding:10px 14px; font-size:12.5px; }
}
</style>
<div class="pdp-inner">
  <div class="pdp-head">
    <span class="pdp-kicker">CARE PROCESS</span>
    <h2 class="pdp-title">진단부터 시공까지 — <b>3단계로 끝</b></h2>
    <p class="pdp-sub">증상만 알려주시면 R&D 박사가 직접 처방서를 작성합니다. 셀프시공 가이드 또는 전문 시공팀 매칭까지 한 번에.</p>
  </div>
  <div class="pdp-steps">
    <div class="pdp-step">
      <div class="pdp-step-num">01</div>
      <div class="pdp-step-name">🩺 진단</div>
      <p class="pdp-step-desc">사진·증상으로 AI 1차 분석 후, 전문의가 직접 검수</p>
      <div class="pdp-step-list">
        <div class="pdp-step-list-item">사진 업로드 또는 증상 체크</div>
        <div class="pdp-step-list-item">AI 하자유형·심각도 자동 분류</div>
        <div class="pdp-step-list-item">R&D 박사 1차 검수</div>
      </div>
      <span class="pdp-step-time">⏱ 평균 3분</span>
    </div>
    <div class="pdp-step">
      <div class="pdp-step-num">02</div>
      <div class="pdp-step-name">💊 처방</div>
      <p class="pdp-step-desc">240만 세대 데이터 기반으로 가장 잘 맞는 방법·자재를 골라드려요</p>
      <div class="pdp-step-list">
        <div class="pdp-step-list-item">맞춤 시공 방법·자재 조합 추천</div>
        <div class="pdp-step-list-item">셀프시공 vs 전문시공 가이드</div>
        <div class="pdp-step-list-item">예상 비용·기간 안내</div>
      </div>
      <span class="pdp-step-time">⏱ 당일 처방서 발송</span>
    </div>
    <div class="pdp-step">
      <div class="pdp-step-num">03</div>
      <div class="pdp-step-name">🔧 시공 (선택)</div>
      <p class="pdp-step-desc">셀프시공 가이드 또는 250+ 전국 파트너 네트워크에서 시공팀 매칭</p>
      <div class="pdp-step-list">
        <div class="pdp-step-list-item">셀프시공 영상·단계 가이드 제공</div>
        <div class="pdp-step-list-item">전문 시공: 지역·경력·등급 기반 매칭</div>
        <div class="pdp-step-list-item">자재 직배송 + 시공팀 일정 조율</div>
      </div>
      <span class="pdp-step-time">⏱ 평균 7~14일 내 진행</span>
    </div>
  </div>
  <div class="pdp-cmp">
    <div class="pdp-cmp-title">일반 건자재 쇼핑몰 <span style="color:#9CA3AF;">vs</span> <b>POUR닥터 서비스</b></div>
    <div class="pdp-cmp-grid">
      <div class="pdp-cmp-cell h">항목</div>
      <div class="pdp-cmp-cell h">일반 쇼핑몰</div>
      <div class="pdp-cmp-cell h us">POUR닥터</div>
      <div class="pdp-cmp-cell">자재 선택</div>
      <div class="pdp-cmp-cell"><span class="no">고객이 직접 검색</span></div>
      <div class="pdp-cmp-cell us"><span class="ok">✓</span> 전문의 처방서 발급</div>
      <div class="pdp-cmp-cell">시공 매칭</div>
      <div class="pdp-cmp-cell"><span class="no">별도 업체 찾아야 함</span></div>
      <div class="pdp-cmp-cell us"><span class="ok">✓</span> 250+ 파트너 자동 매칭 (선택)</div>
      <div class="pdp-cmp-cell">셀프시공 가이드</div>
      <div class="pdp-cmp-cell"><span class="no">상품 설명서 수준</span></div>
      <div class="pdp-cmp-cell us"><span class="ok">✓</span> 단계별 영상·체크리스트 제공</div>
      <div class="pdp-cmp-cell">근거</div>
      <div class="pdp-cmp-cell"><span class="no">상품 설명 위주</span></div>
      <div class="pdp-cmp-cell us"><span class="ok">✓</span> 50+ 특허·240만 세대 데이터</div>
    </div>
  </div>
</div>
</section>`;

  // POUR닥터 페이지 — 전문가 팀 + 빅데이터 신뢰
  const POUR_DR_TRUST_HTML = `<section class="pdt">
<style>
.pdt *, .pdt *::before, .pdt *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pdt { background:#fff; padding:80px 24px; color:#2F3438; letter-spacing:-0.02em; }
.pdt-inner { max-width:1200px; margin:0 auto; }
.pdt-head { text-align:center; margin-bottom:48px; }
.pdt-kicker { display:inline-block; font-size:12.5px; font-weight:700; color:#E8780F; letter-spacing:0.04em; padding:5px 14px; background:#FFF7ED; border:1px solid #FED7AA; border-radius:999px; margin-bottom:14px; }
.pdt-title { font-size:36px; font-weight:900; color:#111111; letter-spacing:-0.045em; line-height:1.25; }
.pdt-title b { color:#E8780F; }
.pdt-sub { margin-top:14px; font-size:16px; font-weight:500; color:#6B7280; letter-spacing:-0.02em; }
/* 팀 카드 */
.pdt-team { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-bottom:48px; }
.pdt-team-card { background:linear-gradient(180deg,#F9FAFB 0%,#fff 100%); border:1px solid #F2F3F5; border-radius:18px; padding:26px; transition:.18s; }
.pdt-team-card:hover { border-color:#E8780F; transform:translateY(-3px); }
.pdt-team-av { width:56px; height:56px; border-radius:16px; display:grid; place-items:center; font-size:24px; margin-bottom:14px; }
.pdt-team-av.av1 { background:linear-gradient(135deg,#DBEAFE,#3B82F6); color:#fff; }
.pdt-team-av.av2 { background:linear-gradient(135deg,#FFEDD5,#E8780F); color:#fff; }
.pdt-team-av.av3 { background:linear-gradient(135deg,#D1FAE5,#059669); color:#fff; }
.pdt-team-role { font-size:11.5px; font-weight:700; color:#6B7280; letter-spacing:0.04em; text-transform:uppercase; margin-bottom:6px; }
.pdt-team-name { font-size:18px; font-weight:800; color:#111; letter-spacing:-0.04em; margin-bottom:8px; }
.pdt-team-desc { font-size:13px; font-weight:500; color:#6B7280; letter-spacing:-0.02em; line-height:1.6; }
.pdt-team-tags { margin-top:14px; display:flex; gap:5px; flex-wrap:wrap; }
.pdt-team-tag { font-size:10.5px; font-weight:700; padding:3px 8px; background:#F3F4F6; color:#374151; border-radius:999px; letter-spacing:-0.02em; }
/* 빅데이터 패널 */
.pdt-data { background:linear-gradient(135deg,#0F1F5C 0%,#1E3A8A 100%); color:#fff; border-radius:24px; padding:48px 36px; position:relative; overflow:hidden; }
.pdt-data::before { content:''; position:absolute; top:-100px; right:-80px; width:340px; height:340px; background:radial-gradient(circle, rgba(232,120,15,.2) 0%, transparent 60%); pointer-events:none; }
.pdt-data-head { text-align:center; margin-bottom:36px; position:relative; z-index:1; }
.pdt-data-kicker { display:inline-block; font-size:11.5px; font-weight:700; color:#FED7AA; letter-spacing:0.06em; padding:4px 12px; background:rgba(232,120,15,.18); border:1px solid rgba(232,120,15,.3); border-radius:999px; margin-bottom:12px; }
.pdt-data-title { font-size:28px; font-weight:900; letter-spacing:-0.045em; line-height:1.3; }
.pdt-data-title b { color:#FED7AA; }
.pdt-data-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; position:relative; z-index:1; }
.pdt-data-cell { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:22px 18px; text-align:center; transition:.15s; }
.pdt-data-cell:hover { background:rgba(255,255,255,.1); }
.pdt-data-num { font-size:34px; font-weight:900; color:#FED7AA; letter-spacing:-0.045em; line-height:1; }
.pdt-data-num small { font-size:18px; font-weight:800; }
.pdt-data-label { margin-top:8px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.78); letter-spacing:-0.02em; line-height:1.4; }
.pdt-data-foot { margin-top:32px; padding-top:24px; border-top:1px solid rgba(255,255,255,.12); display:flex; gap:16px; flex-wrap:wrap; justify-content:center; align-items:center; position:relative; z-index:1; }
.pdt-data-foot-label { font-size:11.5px; font-weight:700; color:rgba(255,255,255,.55); letter-spacing:0.04em; }
.pdt-data-partner { font-size:13px; font-weight:700; color:#fff; letter-spacing:-0.02em; padding:6px 14px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.16); border-radius:999px; }
@media (max-width:900px) {
  .pdt-team { grid-template-columns:1fr; }
  .pdt-data-grid { grid-template-columns:repeat(2,1fr); }
}
@media (max-width:700px) {
  .pdt { padding:56px 16px; }
  .pdt-title { font-size:28px; }
  .pdt-data { padding:32px 22px; border-radius:18px; }
  .pdt-data-title { font-size:22px; }
  .pdt-data-num { font-size:26px; }
}
</style>
<div class="pdt-inner">
  <div class="pdt-head">
    <span class="pdt-kicker">EXPERT TEAM</span>
    <h2 class="pdt-title">당신만의 <b>POUR닥터</b>는 이런 팀입니다</h2>
    <p class="pdt-sub">서울과학기술대학교 공동 R&D · 강남제비스코 생산 파트너십 · 50+ 자체 특허 보유</p>
  </div>
  <div class="pdt-team">
    <div class="pdt-team-card">
      <div class="pdt-team-av av1">🔬</div>
      <div class="pdt-team-role">R&D · 기술</div>
      <div class="pdt-team-name">전문 R&D 박사진</div>
      <p class="pdt-team-desc">서울과학기술대학교 건축·재료 연구진과 공동 개발. 슈퍼복합압축시트·POUR코트재 등 50+ 특허를 만든 기술 진단 책임자들입니다.</p>
      <div class="pdt-team-tags"><span class="pdt-team-tag">건축재료 박사</span><span class="pdt-team-tag">서울과기대 협력</span><span class="pdt-team-tag">건설신기술 1026호</span></div>
    </div>
    <div class="pdt-team-card">
      <div class="pdt-team-av av2">🛠</div>
      <div class="pdt-team-role">전문 시공팀</div>
      <div class="pdt-team-name">현장 진단 시공 전문가</div>
      <p class="pdt-team-desc">전국 250+ 파트너사 시공 전문가 네트워크. 평균 경력 12년, 240만 세대 시공 경험을 처방·매칭에 직접 활용합니다.</p>
      <div class="pdt-team-tags"><span class="pdt-team-tag">평균경력 12년</span><span class="pdt-team-tag">17개 광역</span><span class="pdt-team-tag">240만 세대 경험</span></div>
    </div>
    <div class="pdt-team-card">
      <div class="pdt-team-av av3">📊</div>
      <div class="pdt-team-role">데이터 · AI</div>
      <div class="pdt-team-name">AI 진단 데이터팀</div>
      <p class="pdt-team-desc">240만 세대 진단 데이터와 700+ 단지 시공 결과를 머신러닝으로 학습. Claude Vision으로 사진 진단을 자동화하는 분석 전담팀입니다.</p>
      <div class="pdt-team-tags"><span class="pdt-team-tag">AI Vision</span><span class="pdt-team-tag">240만 세대 학습</span><span class="pdt-team-tag">하자 8종 분류</span></div>
    </div>
  </div>
  <div class="pdt-data">
    <div class="pdt-data-head">
      <span class="pdt-data-kicker">BIG DATA</span>
      <h3 class="pdt-data-title">10년+ 축적된 <b>POUR 빅데이터</b>로<br/>당신의 건물을 진단합니다</h3>
    </div>
    <div class="pdt-data-grid">
      <div class="pdt-data-cell"><div class="pdt-data-num">2.4<small>M+</small></div><div class="pdt-data-label">누적 시공 세대수</div></div>
      <div class="pdt-data-cell"><div class="pdt-data-num">700<small>+</small></div><div class="pdt-data-label">단지 채택 실적</div></div>
      <div class="pdt-data-cell"><div class="pdt-data-num">150<small>만㎡</small></div><div class="pdt-data-label">누적 시공 면적</div></div>
      <div class="pdt-data-cell"><div class="pdt-data-num">50<small>+</small></div><div class="pdt-data-label">자체 R&D 특허·기술</div></div>
      <div class="pdt-data-cell"><div class="pdt-data-num">110<small>+</small></div><div class="pdt-data-label">유지보수 제품</div></div>
      <div class="pdt-data-cell"><div class="pdt-data-num">250<small>+</small></div><div class="pdt-data-label">전국 파트너 네트워크</div></div>
      <div class="pdt-data-cell"><div class="pdt-data-num">850<small>억+</small></div><div class="pdt-data-label">누적 거래액</div></div>
      <div class="pdt-data-cell"><div class="pdt-data-num">50<small>%</small></div><div class="pdt-data-label">연평균 성장률</div></div>
    </div>
    <div class="pdt-data-foot">
      <span class="pdt-data-foot-label">공동 연구·생산 파트너</span>
      <span class="pdt-data-partner">🎓 서울과학기술대학교</span>
      <span class="pdt-data-partner">🏭 강남제비스코</span>
      <span class="pdt-data-partner">📜 국토교통부 건설신기술 1026호</span>
    </div>
  </div>
</div>
</section>`;

  // POUR닥터 페이지 — 무료 진단 폼
  const POUR_DR_FORM_HTML = `<section class="pdf">
<style>
.pdf *, .pdf *::before, .pdf *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.pdf { background:#F9FAFB; padding:80px 24px; color:#2F3438; letter-spacing:-0.02em; }
.pdf-inner { max-width:880px; margin:0 auto; }
.pdf-head { text-align:center; margin-bottom:40px; }
.pdf-kicker { display:inline-block; font-size:12.5px; font-weight:700; color:#E8780F; letter-spacing:0.04em; padding:5px 14px; background:#FFF7ED; border:1px solid #FED7AA; border-radius:999px; margin-bottom:14px; }
.pdf-title { font-size:34px; font-weight:900; color:#111111; letter-spacing:-0.045em; line-height:1.25; }
.pdf-title b { color:#E8780F; }
.pdf-sub { margin-top:14px; font-size:15px; font-weight:500; color:#6B7280; letter-spacing:-0.02em; line-height:1.6; }
.pdf-card { background:#fff; border-radius:20px; padding:36px; box-shadow:0 6px 24px rgba(15,31,92,.06); border:1px solid #F2F3F5; }
.pdf-step { margin-bottom:26px; }
.pdf-step:last-child { margin-bottom:0; }
.pdf-step-label { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:#111; letter-spacing:-0.03em; margin-bottom:12px; }
.pdf-step-num { width:24px; height:24px; border-radius:50%; background:#E8780F; color:#fff; font-size:12px; font-weight:900; display:grid; place-items:center; }
.pdf-step-req { color:#E8780F; }
.pdf-chips { display:flex; gap:8px; flex-wrap:wrap; }
.pdf-chip { padding:9px 16px; font-size:13px; font-weight:600; color:#2F3438; background:#fff; border:1px solid #E5E7EB; border-radius:999px; cursor:pointer; transition:.15s; letter-spacing:-0.02em; }
.pdf-chip:hover { border-color:#9CA3AF; background:#FAFAFA; }
.pdf-chip.on { background:#E8780F; border-color:#E8780F; color:#fff; }
.pdf-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.pdf-input { width:100%; padding:13px 16px; font-size:14px; font-weight:500; color:#2F3438; background:#fff; border:1px solid #E5E7EB; border-radius:10px; outline:none; transition:.15s; letter-spacing:-0.02em; }
.pdf-input::placeholder { color:#9CA3AF; }
.pdf-input:focus { border-color:#E8780F; box-shadow:0 0 0 3px rgba(232,120,15,.12); }
.pdf-textarea { min-height:84px; resize:vertical; line-height:1.55; font-family:inherit; }
.pdf-file-zone { padding:24px; border:2px dashed #D1D5DB; border-radius:12px; text-align:center; cursor:pointer; transition:.15s; background:#FAFAFA; }
.pdf-file-zone:hover { border-color:#E8780F; background:#FFF7ED; }
.pdf-file-ico { font-size:28px; margin-bottom:6px; }
.pdf-file-text { font-size:13.5px; font-weight:700; color:#374151; letter-spacing:-0.02em; }
.pdf-file-sub { margin-top:4px; font-size:11.5px; font-weight:500; color:#9CA3AF; letter-spacing:-0.02em; }
.pdf-agree { display:flex; gap:8px; align-items:flex-start; margin-top:20px; padding:14px 16px; background:#FAFAFA; border-radius:10px; }
.pdf-agree input[type=checkbox] { margin-top:2px; accent-color:#E8780F; cursor:pointer; }
.pdf-agree label { font-size:12.5px; font-weight:500; color:#6B7280; letter-spacing:-0.02em; line-height:1.5; cursor:pointer; }
.pdf-agree label b { color:#2F3438; }
.pdf-submit { width:100%; margin-top:18px; padding:16px; background:#E8780F; color:#fff; font-size:15px; font-weight:800; border-radius:12px; border:none; cursor:pointer; letter-spacing:-0.03em; box-shadow:0 8px 20px rgba(232,120,15,.32); transition:.15s; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
.pdf-submit:hover { background:#C8650D; transform:translateY(-1px); }
.pdf-trust { margin-top:18px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.pdf-trust-item { font-size:11.5px; font-weight:600; color:#6B7280; letter-spacing:-0.02em; display:inline-flex; align-items:center; gap:4px; }
.pdf-trust-item::before { content:'✓'; color:#10B981; font-weight:900; }
@media (max-width:700px) {
  .pdf { padding:56px 14px; }
  .pdf-title { font-size:26px; }
  .pdf-sub { font-size:13.5px; }
  .pdf-card { padding:24px 18px; border-radius:16px; }
  .pdf-grid2 { grid-template-columns:1fr; }
  .pdf-chip { padding:8px 13px; font-size:12.5px; }
}
</style>
<div class="pdf-inner">
  <div class="pdf-head">
    <span class="pdf-kicker">FREE DIAGNOSIS</span>
    <h2 class="pdf-title">지금 <b>무료 진단</b>을 시작해보세요</h2>
    <p class="pdf-sub">아래 정보만 입력하시면 R&D 박사가 직접 처방서를 작성해<br/><b>카카오톡으로 3분 이내</b> 보내드립니다.</p>
  </div>
  <form class="pdf-card" onsubmit="return false;">
    <div class="pdf-step">
      <div class="pdf-step-label"><span class="pdf-step-num">1</span>건물 유형 <span class="pdf-step-req">*</span></div>
      <div class="pdf-chips" data-pdf-chips="single">
        <button type="button" class="pdf-chip on">아파트</button>
        <button type="button" class="pdf-chip">관공서</button>
        <button type="button" class="pdf-chip">상가·오피스텔</button>
        <button type="button" class="pdf-chip">공장·창고</button>
        <button type="button" class="pdf-chip">학교·병원</button>
        <button type="button" class="pdf-chip">단독·빌라</button>
      </div>
    </div>
    <div class="pdf-step">
      <div class="pdf-step-label"><span class="pdf-step-num">2</span>주요 증상 (복수 선택 가능)<span class="pdf-step-req"> *</span></div>
      <div class="pdf-chips" data-pdf-chips="multi">
        <button type="button" class="pdf-chip">💧 누수</button>
        <button type="button" class="pdf-chip">⚡ 균열·크랙</button>
        <button type="button" class="pdf-chip">🧱 박락·박리</button>
        <button type="button" class="pdf-chip">🦠 곰팡이·결로</button>
        <button type="button" class="pdf-chip">🦠 백화현상</button>
        <button type="button" class="pdf-chip">🪲 철근 노출</button>
        <button type="button" class="pdf-chip">🟫 녹·부식</button>
        <button type="button" class="pdf-chip">🎨 도장 열화</button>
        <button type="button" class="pdf-chip">🏚 슁글·기와 탈락</button>
      </div>
    </div>
    <div class="pdf-step">
      <div class="pdf-step-label"><span class="pdf-step-num">3</span>증상이 발생한 위치 / 메모</div>
      <textarea class="pdf-input pdf-textarea" placeholder="예: 102동 옥상 슬라브 / 가장자리 드레인 주변 누수 / 작년 7월부터 점점 심해짐"></textarea>
    </div>
    <div class="pdf-step">
      <div class="pdf-step-label"><span class="pdf-step-num">4</span>사진 첨부 (선택, 최대 5장)</div>
      <label class="pdf-file-zone">
        <div class="pdf-file-ico">📷</div>
        <div class="pdf-file-text">사진을 끌어다 놓거나 클릭해서 업로드</div>
        <div class="pdf-file-sub">JPG · PNG · HEIC · 최대 10MB / 사진당</div>
        <input type="file" accept="image/*" multiple hidden/>
      </label>
    </div>
    <div class="pdf-step">
      <div class="pdf-step-label"><span class="pdf-step-num">5</span>연락처 <span class="pdf-step-req">*</span></div>
      <div class="pdf-grid2">
        <input type="text" class="pdf-input" placeholder="성함" required/>
        <input type="tel" class="pdf-input" placeholder="010-0000-0000" required/>
      </div>
    </div>
    <div class="pdf-agree">
      <input type="checkbox" id="pdf-agree-1" checked/>
      <label for="pdf-agree-1"><b>개인정보 수집·이용 동의</b> — 진단 결과 안내 목적으로만 사용되며, 마케팅 수신은 별도 동의 시에만 적용됩니다. 보관 기간: 진단 완료 후 6개월.</label>
    </div>
    <button type="submit" class="pdf-submit">🩺 무료 진단 처방서 받기 (3분 이내)</button>
    <div class="pdf-trust">
      <span class="pdf-trust-item">SSL 암호화</span>
      <span class="pdf-trust-item">개인정보 6개월 후 자동 파기</span>
      <span class="pdf-trust-item">광고·홍보 발송 없음</span>
    </div>
  </form>
</div>
<script>
(function(){
  var root = document.currentScript && document.currentScript.parentElement;
  if (!root) return;
  root.querySelectorAll('[data-pdf-chips]').forEach(function(group){
    var mode = group.dataset.pdfChips;
    group.querySelectorAll('.pdf-chip').forEach(function(c){
      c.addEventListener('click', function(){
        if (mode === 'single') {
          group.querySelectorAll('.pdf-chip').forEach(function(x){ x.classList.remove('on'); });
          c.classList.add('on');
        } else {
          c.classList.toggle('on');
        }
      });
    });
  });
})();
</script>
</section>`;

  const SEED_CATEGORY_HTML = `<style>
.psc3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.psc3 { background:#fff; padding:48px 16px 36px; }
.psc3-inner { max-width:1200px; margin:0 auto; }
.psc3-head { text-align:center; margin-bottom:28px; }
.psc3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
.psc3-head h2 { font-size:24px; font-weight:900; color:#0F1F5C; letter-spacing:-.5px; }
.psc3-grid { display:grid; grid-template-columns:repeat(9, 1fr); gap:8px; }
.psc3-item { display:flex; flex-direction:column; align-items:center; gap:10px; padding:18px 8px; background:#FFFBF5; border-radius:18px; cursor:pointer; transition:all .25s; text-decoration:none; color:inherit; border:1px solid transparent; }
.psc3-item:hover { background:#fff; border-color:#FED7AA; transform:translateY(-4px); box-shadow:0 12px 28px rgba(249,115,22,.12); }
.psc3-item .icon { width:52px; height:52px; border-radius:14px; background:#fff; display:grid; place-items:center; transition:all .25s; box-shadow:0 4px 10px rgba(249,115,22,.08); }
.psc3-item:hover .icon { background:linear-gradient(135deg,#F97316,#EA580C); transform:rotate(-6deg) scale(1.05); box-shadow:0 8px 20px rgba(249,115,22,.35); }
.psc3-item .icon svg { width:26px; height:26px; fill:none; stroke:#EA580C; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; transition:stroke .25s; }
.psc3-item:hover .icon svg { stroke:#fff; }
.psc3-item .label { font-size:12.5px; font-weight:700; color:#0F1F5C; text-align:center; line-height:1.35; word-break:keep-all; letter-spacing:-.2px; }
@media (max-width:880px) { .psc3-grid { grid-template-columns:repeat(5, 1fr); } }
@media (max-width:520px) { .psc3-grid { grid-template-columns:repeat(3, 1fr); gap:8px; } .psc3-item { padding:18px 6px; } .psc3-item .icon { width:54px; height:54px; } .psc3-item .icon svg { width:27px; height:27px; } .psc3-item .label { font-size:13px; } }
</style>
<section class="psc3">
  <div class="psc3-inner">
    <div class="psc3-head">
      <div class="kicker">QUICK MENU</div>
      <h2>어떤 도움이 필요하세요?</h2>
    </div>
    <div class="psc3-grid">
      <a class="psc3-item" href="https://www.pourstore.net/category/products"><div class="icon"><svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div><div class="label">제품 구매</div></a>
      <a class="psc3-item" href="https://www.pourstore.net/category/packages"><div class="icon"><svg viewBox="0 0 24 24"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="label">패키지 구매</div></a>
      <a class="psc3-item" href="https://www.pourstore.net/consult"><div class="icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></svg></div><div class="label">시공 상담</div></a>
      <a class="psc3-item" href="https://www.pourstore.net/guide"><div class="icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg></div><div class="label">시공 가이드</div></a>
      <a class="psc3-item" href="https://www.pourstore.net/showroom"><div class="icon"><svg viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div><div class="label">쇼룸</div></a>
      <a class="psc3-item" href="https://www.pourstore.net/category/safety"><div class="icon"><svg viewBox="0 0 24 24"><path d="M20.91 11.12A1 1 0 0 0 20 10h-2.26a4 4 0 0 0-7.48 0H4a1 1 0 0 0-.91 1.39l1.74 4.34A2 2 0 0 0 6.69 17h10.62a2 2 0 0 0 1.86-1.27Z"/><circle cx="12" cy="10" r="2"/></svg></div><div class="label">부자재<br/>안전용품</div></a>
      <a class="psc3-item" href="https://www.pourstore.net/training"><div class="icon"><svg viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><div class="label">체험·교육<br/>신청</div></a>
      <a class="psc3-item" href="https://www.pourstore.net/partners"><div class="icon"><svg viewBox="0 0 24 24"><path d="M11 17a4 4 0 0 1-4-4V7a4 4 0 0 1 8 0v6a4 4 0 0 1-4 4Z"/><path d="M19 11h2a2 2 0 0 1 0 4h-1"/><path d="M3 11H1a2 2 0 0 0 0 4h1"/></svg></div><div class="label">파트너사<br/>협약</div></a>
      <a class="psc3-item" href="https://www.pourstore.net/cs"><div class="icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg></div><div class="label">고객센터</div></a>
    </div>
  </div>
</section>`;

  const SEED_POPULAR_HTML = `<style>
.psp3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.psp3 { background:#fff; padding:80px 18px; }
.psp3-inner { max-width:1200px; margin:0 auto; }
.psp3-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:32px; flex-wrap:wrap; gap:14px; }
.psp3-head .left { flex:1; min-width:240px; }
.psp3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
.psp3-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
.psp3-head .more { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:800; color:#0F1F5C; text-decoration:none; padding:11px 18px; background:#fff; border:1.5px solid #E5E7EB; border-radius:999px; transition:all .2s; }
.psp3-head .more:hover { border-color:#0F1F5C; background:#0F1F5C; color:#fff; }
.psp3-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px; }
.psp3-card { background:#fff; border-radius:20px; overflow:hidden; cursor:pointer; transition:all .3s; text-decoration:none; color:inherit; display:block; border:1px solid #F3F4F6; }
.psp3-card:hover { transform:translateY(-6px); box-shadow:0 24px 48px rgba(15,31,92,.12); border-color:#FED7AA; }
.psp3-card .img { aspect-ratio:1/1; background:linear-gradient(135deg,#FFFBF5,#FFEDD5) center/cover no-repeat; position:relative; overflow:hidden; }
.psp3-card .img::before { content:''; position:absolute; inset:0; background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.5), transparent 60%); }
.psp3-card .badge { position:absolute; top:12px; left:12px; padding:5px 11px; background:#0F1F5C; color:#fff; font-size:10.5px; font-weight:800; border-radius:6px; letter-spacing:.5px; z-index:2; }
.psp3-card .badge.new { background:#F97316; }
.psp3-card .ic { position:absolute; bottom:0; left:0; right:0; height:60%; display:grid; place-items:center; font-family:'Bebas Neue',sans-serif; font-size:54px; font-weight:900; color:rgba(15,31,92,.55); letter-spacing:1px; line-height:1; }
.psp3-card .body { padding:18px 18px 20px; }
.psp3-card .cat { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:6px; }
.psp3-card .name { font-size:15px; font-weight:800; color:#0F1F5C; line-height:1.4; margin-bottom:8px; letter-spacing:-.3px; }
.psp3-card .desc { font-size:12.5px; color:#6B7280; line-height:1.5; min-height:38px; }
.psp3-card .meta { display:flex; align-items:center; justify-content:space-between; margin-top:14px; padding-top:14px; border-top:1px solid #F3F4F6; }
.psp3-card .stars { display:inline-flex; align-items:center; gap:4px; font-size:12px; color:#0F1F5C; font-weight:700; }
.psp3-card .stars::before { content:'★'; color:#F97316; }
.psp3-card .arr { width:28px; height:28px; border-radius:50%; background:#FFFBF5; display:grid; place-items:center; font-size:14px; color:#6B7280; transition:all .25s; }
.psp3-card:hover .arr { background:#F97316; color:#fff; transform:translateX(2px); }
@media (max-width:640px) { .psp3-grid { grid-template-columns:repeat(2, 1fr); gap:10px; } .psp3-head h2 { font-size:24px; } .psp3-card .body { padding:14px; } .psp3-card .name { font-size:13.5px; } }
</style>
<section class="psp3">
  <div class="psp3-inner">
    <div class="psp3-head">
      <div class="left">
        <div class="kicker">BEST SELLERS</div>
        <h2>가장 많이 찾는<br/>인기 추천 상품</h2>
      </div>
      <a class="more" href="https://www.pourstore.net/category/best">전체보기 →</a>
    </div>
    <div class="psp3-grid">
      <a class="psp3-card" href="https://www.pourstore.net/product/seed-paint"><div class="img"><span class="badge">BEST 1</span><div class="ic">PAINT+</div></div><div class="body"><div class="cat">PAINT</div><div class="name">POUR 씨릿 페인트 플러스</div><div class="desc">균열에 따라 늘어나는 고기능성 인테리어&외벽 페인트</div><div class="meta"><span class="stars">4.9 (1.2K)</span><span class="arr">→</span></div></div></a>
      <a class="psp3-card" href="https://www.pourstore.net/product/coat"><div class="img"><span class="badge">BEST 2</span><div class="ic">COAT</div></div><div class="body"><div class="cat">WATERPROOF</div><div class="name">POUR 코트재</div><div class="desc">방수·단열·차열·중성화 방지 — KS 4배 인장강도</div><div class="meta"><span class="stars">4.8 (980)</span><span class="arr">→</span></div></div></a>
      <a class="psp3-card" href="https://www.pourstore.net/product/hyper-t"><div class="img"><span class="badge new">NEW</span><div class="ic">HYPER</div></div><div class="body"><div class="cat">PUTTY</div><div class="name">POUR 하이퍼티</div><div class="desc">600% 늘어나는 초고신율 탄성 퍼티</div><div class="meta"><span class="stars">5.0 (640)</span><span class="arr">→</span></div></div></a>
      <a class="psp3-card" href="https://www.pourstore.net/product/crack-pack"><div class="img"><span class="badge">SET</span><div class="ic">CRACK</div></div><div class="body"><div class="cat">REPAIR SET</div><div class="name">POUR 균열보수 세트</div><div class="desc">하이퍼티 + 크랙시트 — 외벽 균열 한 번에</div><div class="meta"><span class="stars">4.9 (520)</span><span class="arr">→</span></div></div></a>
      <a class="psp3-card" href="https://www.pourstore.net/product/grohome-tools"><div class="img"><span class="badge new">PRO</span><div class="ic">TOOLS</div></div><div class="body"><div class="cat">TOOLS</div><div class="name">GROHOME TOOLS PRO</div><div class="desc">프리미엄 작업 도구 — 손에 쥐는 그립과 균일한 작업감</div><div class="meta"><span class="stars">4.9 (380)</span><span class="arr">→</span></div></div></a>
    </div>
  </div>
</section>`;

  const SEED_NEW_ARRIVALS_HTML = `<style>
.psn3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.psn3 { background:#FFFBF5; padding:80px 18px; }
.psn3-inner { max-width:1200px; margin:0 auto; }
.psn3-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:18px; }
.psn3-head .left { flex:1; min-width:240px; }
.psn3-head .kicker { display:inline-flex; align-items:center; gap:8px; font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
.psn3-head .kicker::before { content:''; width:24px; height:1.5px; background:#EA580C; }
.psn3-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
.psn3-tabs { display:flex; gap:6px; flex-wrap:wrap; }
.psn3-tab { padding:9px 16px; background:#fff; border:1.5px solid #E5E7EB; border-radius:999px; font-size:12.5px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; letter-spacing:-.2px; }
.psn3-tab:hover { border-color:#0F1F5C; color:#0F1F5C; }
.psn3-tab.on { background:#0F1F5C; border-color:#0F1F5C; color:#fff; }
.psn3-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:14px; }
.psn3-card { background:#fff; border-radius:18px; overflow:hidden; cursor:pointer; transition:all .25s; text-decoration:none; color:inherit; display:block; position:relative; border:1px solid #F3F4F6; }
.psn3-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.1); border-color:#FED7AA; }
.psn3-card .img { aspect-ratio:1/1; background:linear-gradient(135deg,#FFFBF5,#FFEDD5) center/cover no-repeat; position:relative; }
.psn3-card .img .ic { position:absolute; inset:0; display:grid; place-items:center; font-size:48px; }
.psn3-card .new { position:absolute; top:10px; right:10px; padding:4px 10px; background:#F97316; color:#fff; font-size:10.5px; font-weight:800; border-radius:6px; letter-spacing:.5px; }
.psn3-card .when { position:absolute; bottom:10px; left:10px; padding:3px 9px; background:rgba(255,255,255,.95); color:#0F1F5C; font-size:10px; font-weight:700; border-radius:5px; }
.psn3-card .body { padding:14px 16px 16px; }
.psn3-card .name { font-size:13.5px; font-weight:700; color:#0F1F5C; line-height:1.4; margin-bottom:8px; min-height:38px; letter-spacing:-.2px; }
.psn3-card .price-row { display:flex; align-items:baseline; gap:8px; }
.psn3-card .price { font-size:17px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; }
.psn3-card .price .won { font-size:12px; color:#6B7280; margin-left:1px; font-weight:600; }
.psn3-card .strike { font-size:12px; color:#9CA3AF; text-decoration:line-through; }
@media (max-width:640px) { .psn3-grid { grid-template-columns:repeat(2, 1fr); gap:10px; } .psn3-head h2 { font-size:24px; } }
</style>
<section class="psn3">
  <div class="psn3-inner">
    <div class="psn3-head">
      <div class="left">
        <div class="kicker">NEW ARRIVALS</div>
        <h2>이달의 신상품</h2>
      </div>
      <div class="psn3-tabs">
        <button class="psn3-tab on">전체</button>
        <button class="psn3-tab">안전용품</button>
        <button class="psn3-tab">부자재</button>
        <button class="psn3-tab">작업 도구</button>
      </div>
    </div>
    <div class="psn3-grid">
      <a class="psn3-card" href="https://www.pourstore.net/product/safety-rope"><div class="img"><div class="ic">🧵</div><span class="new">NEW</span><span class="when">3일 전 입고</span></div><div class="body"><div class="name">PE 산업용 안전 띄움 로프</div><div class="price-row"><div class="price">55,000<span class="won">원</span></div></div></div></a>
      <a class="psn3-card" href="https://www.pourstore.net/product/helmet"><div class="img"><div class="ic">⛑️</div><span class="new">NEW</span><span class="when">5일 전 입고</span></div><div class="body"><div class="name">고급 경량 안전모 / 사계절 건설 현장</div><div class="price-row"><div class="price">5,500<span class="won">원</span></div><span class="strike">8,000원</span></div></div></a>
      <a class="psn3-card" href="https://www.pourstore.net/product/gloves"><div class="img"><div class="ic">🧤</div><span class="new">NEW</span><span class="when">1주 전 입고</span></div><div class="body"><div class="name">양면 라텍스 코팅 작업 장갑 10족</div><div class="price-row"><div class="price">3,900<span class="won">원</span></div></div></div></a>
      <a class="psn3-card" href="https://www.pourstore.net/product/safety-vest"><div class="img"><div class="ic">🦺</div><span class="new">NEW</span><span class="when">1주 전 입고</span></div><div class="body"><div class="name">통기성 안전 조끼 / 야간 인식</div><div class="price-row"><div class="price">5,000<span class="won">원</span></div></div></div></a>
      <a class="psn3-card" href="https://www.pourstore.net/product/cone"><div class="img"><div class="ic">🚧</div><span class="new">NEW</span><span class="when">2주 전 입고</span></div><div class="body"><div class="name">안전 휀스 / 현장 표지 콘 (3500g)</div><div class="price-row"><div class="price">42,000<span class="won">원</span></div></div></div></a>
    </div>
  </div>
</section>`;

  const SEED_SUBCATEGORY_HTML = `<style>
.pss2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.pss2 { background:#fff; padding:80px 18px; }
.pss2-inner { max-width:1200px; margin:0 auto; }
.pss2-head { text-align:center; margin-bottom:32px; }
.pss2-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
.pss2-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
.pss2-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.pss2-card { border-radius:24px; overflow:hidden; padding:0; min-height:380px; position:relative; cursor:pointer; transition:all .35s; text-decoration:none; color:inherit; display:flex; flex-direction:column; justify-content:space-between; }
.pss2-card:hover { transform:translateY(-6px); box-shadow:0 28px 60px rgba(0,0,0,.18); }
.pss2-card.dream { background:linear-gradient(135deg,#064E3B 0%,#047857 50%,#10B981 100%); color:#fff; }
.pss2-card.gro { background:linear-gradient(135deg,#7C2D12 0%,#C2410C 50%,#F97316 100%); color:#fff; }
.pss2-card .head { padding:36px 36px 0; position:relative; z-index:2; }
.pss2-card .label { display:inline-block; padding:6px 14px; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.3); border-radius:999px; font-size:11px; font-weight:800; color:#fff; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); margin-bottom:18px; letter-spacing:.5px; }
.pss2-card .brand { font-family:'Bebas Neue',sans-serif; font-size:48px; font-weight:900; line-height:1; letter-spacing:2px; margin-bottom:14px; color:#fff; }
.pss2-card .tag { font-size:14px; color:rgba(255,255,255,.85); line-height:1.65; margin-bottom:24px; max-width:340px; letter-spacing:-.2px; }
.pss2-card .stats { display:flex; gap:20px; margin-bottom:24px; }
.pss2-card .stats .s { color:#fff; }
.pss2-card .stats .s .v { font-family:'Bebas Neue',sans-serif; font-size:20px; }
.pss2-card .stats .s .l { font-size:11px; opacity:.7; margin-top:2px; }
.pss2-card .preview { display:flex; gap:8px; padding:0 36px; align-items:flex-end; flex:1; overflow:hidden; }
.pss2-card .preview .item { flex:1; aspect-ratio:3/4; background:rgba(255,255,255,.95) center/contain no-repeat; border-radius:14px 14px 0 0; box-shadow:0 -8px 30px rgba(0,0,0,.2); transition:transform .3s; }
.pss2-card:hover .preview .item:nth-child(1) { transform:translateY(-8px) rotate(-3deg); }
.pss2-card:hover .preview .item:nth-child(2) { transform:translateY(-12px); }
.pss2-card:hover .preview .item:nth-child(3) { transform:translateY(-8px) rotate(3deg); }
.pss2-card .more { position:absolute; top:36px; right:36px; width:48px; height:48px; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.3); border-radius:50%; display:grid; place-items:center; color:#fff; font-size:18px; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); transition:all .25s; }
.pss2-card:hover .more { background:#fff; color:#0F1F5C; transform:rotate(-45deg) scale(1.1); }
@media (max-width:720px) { .pss2-grid { grid-template-columns:1fr; } .pss2-card { min-height:320px; } .pss2-card .head { padding:28px 28px 0; } .pss2-card .preview { padding:0 28px; } .pss2-card .more { top:28px; right:28px; width:40px; height:40px; } .pss2-card .brand { font-size:36px; } .pss2-head h2 { font-size:24px; } }
</style>
<section class="pss2">
  <div class="pss2-inner">
    <div class="pss2-head">
      <div class="kicker">SUB CATEGORIES</div>
      <h2>POUR스토어 패밀리 브랜드</h2>
    </div>
    <div class="pss2-grid">
      <a class="pss2-card dream" href="https://www.pourstore.net/category/dreamcoat">
        <div class="head">
          <span class="label">제비스코 라인 · 친환경</span>
          <div class="brand">DREAM COAT</div>
          <p class="tag">한국 1위 페인트 제비스코의 친환경 인테리어 라인 — 실내·외 모두 안전하게.</p>
          <div class="stats"><div class="s"><div class="v">4.9</div><div class="l">평점</div></div><div class="s"><div class="v">12K+</div><div class="l">리뷰</div></div></div>
        </div>
        <div class="preview"><div class="item" style="background-image:url('https://placehold.co/200x280/059669/fff?text=DREAM')"></div><div class="item" style="background-image:url('https://placehold.co/200x280/047857/fff?text=COAT')"></div><div class="item" style="background-image:url('https://placehold.co/200x280/065F46/fff?text=GREEN')"></div></div>
        <div class="more">→</div>
      </a>
      <a class="pss2-card gro" href="https://grohome.co.kr">
        <div class="head">
          <span class="label">+ 인테리어 · 홈 리페어</span>
          <div class="brand">GROHOME</div>
          <p class="tag">POUR 기술 기반 홈 리페어 — 누구나 스스로 고칠 수 있도록 일상에 맞춰 재설계.</p>
          <div class="stats"><div class="s"><div class="v">4.8</div><div class="l">평점</div></div><div class="s"><div class="v">8K+</div><div class="l">리뷰</div></div></div>
        </div>
        <div class="preview"><div class="item" style="background-image:url('https://placehold.co/200x280/F97316/fff?text=GRO')"></div><div class="item" style="background-image:url('https://placehold.co/200x280/EA580C/fff?text=HOME')"></div><div class="item" style="background-image:url('https://placehold.co/200x280/C2410C/fff?text=DIY')"></div></div>
        <div class="more">→</div>
      </a>
    </div>
  </div>
</section>`;

  const SEED_YOUTUBE_HTML = `<style>
.psy3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.psy3 { background:#FFFBF5; padding:80px 18px; position:relative; }
.psy3-inner { max-width:1200px; margin:0 auto; }
.psy3-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:32px; flex-wrap:wrap; gap:14px; }
.psy3-head .left { flex:1; min-width:240px; }
.psy3-head .kicker { display:inline-flex; align-items:center; gap:8px; font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:10px; }
.psy3-head .kicker::before { content:''; width:24px; height:1.5px; background:#EA580C; }
.psy3-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
.psy3-head h2 .yt { display:inline-flex; align-items:center; gap:6px; font-size:14px; vertical-align:middle; margin-left:8px; padding:5px 11px; background:#FEE2E2; border:1px solid #FCA5A5; color:#DC2626; border-radius:6px; font-weight:800; }
.psy3-head p { font-size:13.5px; color:#6B7280; margin-top:8px; max-width:520px; }
.psy3-head .more { display:inline-flex; align-items:center; gap:6px; padding:11px 18px; background:#fff; border:1.5px solid #E5E7EB; border-radius:999px; color:#0F1F5C; font-size:13px; font-weight:800; text-decoration:none; transition:all .2s; }
.psy3-head .more:hover { border-color:#0F1F5C; background:#0F1F5C; color:#fff; }
.psy3-grid { display:grid; grid-template-columns:repeat(5, 1fr); gap:16px; }
.psy3-card { aspect-ratio:9/16; border-radius:18px; overflow:hidden; cursor:pointer; position:relative; transition:all .3s; text-decoration:none; color:inherit; display:block; box-shadow:0 6px 18px rgba(15,31,92,.08); border:1px solid #F3F4F6; background:#fff; }
.psy3-card:hover { transform:translateY(-6px); box-shadow:0 22px 44px rgba(15,31,92,.16); border-color:#FED7AA; }
.psy3-card .img { position:absolute; inset:0; background:#0F1F5C center/cover no-repeat; }
.psy3-card .img::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.05) 0%, transparent 30%, rgba(0,0,0,.7) 100%); }
.psy3-card .play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:56px; height:56px; background:rgba(255,255,255,.95); border-radius:50%; display:grid; place-items:center; box-shadow:0 8px 22px rgba(0,0,0,.25); transition:all .25s; }
.psy3-card:hover .play { background:#DC2626; transform:translate(-50%,-50%) scale(1.08); box-shadow:0 8px 22px rgba(220,38,38,.4); }
.psy3-card .play::after { content:''; border:0 solid transparent; border-left:14px solid #DC2626; border-top:9px solid transparent; border-bottom:9px solid transparent; margin-left:3px; transition:border-left-color .25s; }
.psy3-card:hover .play::after { border-left-color:#fff; }
.psy3-card .views { position:absolute; top:12px; left:12px; padding:4px 9px; background:rgba(255,255,255,.95); border-radius:5px; color:#0F1F5C; font-size:10.5px; font-weight:800; display:flex; align-items:center; gap:4px; z-index:1; }
.psy3-card .views::before { content:'▶'; font-size:8px; color:#DC2626; }
.psy3-card .duration { position:absolute; top:12px; right:12px; padding:4px 8px; background:rgba(15,31,92,.85); color:#fff; font-size:10.5px; font-weight:700; border-radius:5px; z-index:1; }
.psy3-card .title { position:absolute; bottom:14px; left:14px; right:14px; color:#fff; font-size:13px; font-weight:700; line-height:1.45; z-index:1; letter-spacing:-.2px; }
/* 재생 상태 표시 */
.psy3-card .psy3-prog { position:absolute; left:14px; right:14px; bottom:6px; height:3px; background:rgba(255,255,255,.22); border-radius:99px; overflow:hidden; z-index:2; opacity:0; transition:opacity .3s; }
.psy3-card[data-psy3-active] .psy3-prog { opacity:1; }
.psy3-card .psy3-prog::after { content:''; position:absolute; left:0; top:0; bottom:0; width:0; background:#fff; border-radius:99px; }
.psy3-card[data-psy3-active] .psy3-prog::after { animation:psy3Fill var(--psy3-d, 5s) linear forwards; }
@keyframes psy3Fill { to { width:100%; } }
.psy3-card[data-psy3-active] .play { background:#DC2626; box-shadow:0 8px 22px rgba(220,38,38,.55); }
.psy3-card[data-psy3-active] .play::after { border-left-color:#fff; }
.psy3-card[data-psy3-active] { outline:2px solid #E8780F; outline-offset:-2px; }
@media (max-width:700px) {
  .psy3 { padding:48px 0 56px; }
  .psy3-inner { max-width:none; }
  .psy3-head { padding:0 18px; margin-bottom:20px; }
  .psy3-head h2 { font-size:24px; }
  .psy3-head .more { font-size:12px; padding:9px 14px; }
  .psy3-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; padding:0 16px; }
  .psy3-grid .psy3-card:nth-child(n+5) { display:none; }
  .psy3-card { max-width:none; aspect-ratio:9/16; }
  .psy3-card .title { font-size:12.5px; bottom:12px; left:12px; right:12px; }
  .psy3-card .play { width:46px; height:46px; }
  .psy3-card .play::after { border-left:11px solid #DC2626; border-top:7px solid transparent; border-bottom:7px solid transparent; }
  .psy3-card .views, .psy3-card .duration { top:10px; font-size:10px; padding:3px 7px; }
}
@media (max-width:520px) { .psy3-head h2 { font-size:22px; } .psy3-card .title { font-size:12px; } }
</style>
<section class="psy3">
  <div class="psy3-inner">
    <div class="psy3-head">
      <div class="left">
        <div class="kicker">SHORTS</div>
        <h2>POUR스토어 숏츠 영상<span class="yt">▶ 1분 시공</span></h2>
        <p>구구단 외우는 것처럼 간단한 시공법 — 1분이면 핵심만 쏙</p>
      </div>
      <a class="more" href="https://www.pourstore.net/videos">전체 영상 →</a>
    </div>
    <div class="psy3-grid" data-psy3-scroll>
      <a class="psy3-card" data-psy3-dur="5" href="https://www.pourstore.net/videos/short1"><div class="img" style="background-image:url('https://placehold.co/300x533/0F1F5C/F97316?text=DRAIN')"></div><span class="views">12K</span><span class="duration">0:48</span><div class="play"></div><div class="title">옥상 배수구 누수 1분 보수법</div><span class="psy3-prog"></span></a>
      <a class="psy3-card" data-psy3-dur="5" href="https://www.pourstore.net/videos/short2"><div class="img" style="background-image:url('https://placehold.co/300x533/EA580C/fff?text=ROOF')"></div><span class="views">8.5K</span><span class="duration">0:55</span><div class="play"></div><div class="title">방수보수 빌라·아파트 차이</div><span class="psy3-prog"></span></a>
      <a class="psy3-card" data-psy3-dur="5" href="https://www.pourstore.net/videos/short3"><div class="img" style="background-image:url('https://placehold.co/300x533/F97316/fff?text=SHINGLE')"></div><span class="views">15K</span><span class="duration">1:00</span><div class="play"></div><div class="title">슁글 지붕에 방수페인트 칠하면?</div><span class="psy3-prog"></span></a>
      <a class="psy3-card" data-psy3-dur="5" href="https://www.pourstore.net/videos/short4"><div class="img" style="background-image:url('https://placehold.co/300x533/059669/fff?text=CRACK')"></div><span class="views">6.2K</span><span class="duration">0:42</span><div class="play"></div><div class="title">콘크리트 균열 봉합 한 방에</div><span class="psy3-prog"></span></a>
      <a class="psy3-card" data-psy3-dur="5" href="https://www.pourstore.net/videos/short5"><div class="img" style="background-image:url('https://placehold.co/300x533/9333EA/fff?text=COAT')"></div><span class="views">9.8K</span><span class="duration">0:38</span><div class="play"></div><div class="title">옥상 방수는 코트재로 끝</div><span class="psy3-prog"></span></a>
    </div>
  </div>
  <script>
  (function(){
    var root = document.currentScript && document.currentScript.parentElement;
    if (!root) return;
    var scroller = root.querySelector('[data-psy3-scroll]');
    if (!scroller) return;
    var cards = Array.prototype.slice.call(scroller.querySelectorAll('.psy3-card'));
    if (cards.length === 0) return;
    var current = 0, paused = false, inView = false;
    var advanceT = null, resumeT = null;
    function visCards(){ return cards.filter(function(c){ return c.offsetParent !== null; }); }
    function durMsEl(el){
      var d = parseFloat(el.getAttribute('data-psy3-dur') || '5');
      return Math.min(Math.max(d, 3), 10) * 1000;
    }
    function clearAdvance(){ if (advanceT) { clearTimeout(advanceT); advanceT = null; } }
    function activate(i){
      clearAdvance();
      var list = visCards();
      if (!list.length) return;
      current = ((i % list.length) + list.length) % list.length;
      var active = list[current];
      cards.forEach(function(c){
        if (c === active) {
          c.style.setProperty('--psy3-d', (durMsEl(c)/1000) + 's');
          // 애니메이션 재시작을 위해 속성을 잠깐 떼었다 다시 붙임
          c.removeAttribute('data-psy3-active');
          void c.offsetWidth;
          c.setAttribute('data-psy3-active', '');
        } else {
          c.removeAttribute('data-psy3-active');
        }
      });
      // 그리드 — 보이는 카드만 순환 강조 (모바일 숨김 카드 건너뜀)
      if (!paused && inView && !document.hidden) {
        advanceT = setTimeout(function(){ activate(current + 1); }, durMsEl(active));
      }
    }
    function pauseFor(ms){
      paused = true;
      clearAdvance();
      if (resumeT) clearTimeout(resumeT);
      resumeT = setTimeout(function(){ paused = false; if (inView) activate(current); }, ms || 6000);
    }
    scroller.addEventListener('touchstart', function(){ pauseFor(7000); }, {passive:true});
    scroller.addEventListener('pointerdown', function(){ pauseFor(7000); });
    scroller.addEventListener('mouseenter', function(){ pauseFor(9000); });
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) clearAdvance();
      else if (inView && !paused) activate(current);
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          inView = e.isIntersecting;
          if (inView && !paused) activate(current);
          else clearAdvance();
        });
      }, { threshold: 0.3 });
      io.observe(scroller);
    } else {
      inView = true; activate(0);
    }
  })();
  </script>
</section>`;

  const SEED_SERVICE_HTML = `<style>
.psv2 *, .psv2 *::before, .psv2 *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.psv2 { background:#fff; padding:64px 18px 72px; color:#2F3438; letter-spacing:-0.02em; }
.psv2-inner { max-width:880px; margin:0 auto; }
.psv2-head { text-align:center; margin-bottom:28px; }
.psv2-head .kicker { display:inline-block; font-size:12px; font-weight:800; color:#E8780F; letter-spacing:0.06em; padding:4px 12px; background:#FFF7ED; border:1px solid #FED7AA; border-radius:999px; margin-bottom:12px; }
.psv2-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-0.045em; line-height:1.25; margin-bottom:8px; }
.psv2-head p { font-size:13.5px; font-weight:500; color:#6B7280; }
/* 아코디언 */
.psv2-acc { display:flex; flex-direction:column; gap:10px; }
.psv2-item { background:#fff; border:1.5px solid #F2F3F5; border-radius:16px; overflow:hidden; transition:.25s; }
.psv2-item:hover { border-color:#E5E7EB; }
.psv2-item.open { box-shadow:0 8px 28px rgba(15,31,92,.08); }
.psv2-item.shop.open { border-color:#FED7AA; }
.psv2-item.partner.open { border-color:#BFDBFE; }
.psv2-item.show.open { border-color:#A7F3D0; }
.psv2-summary { display:flex; align-items:center; gap:14px; padding:18px 22px; cursor:pointer; background:transparent; border:none; width:100%; text-align:left; font-family:inherit; color:inherit; transition:.18s; }
.psv2-summary:hover { background:#FAFAFA; }
.psv2-item.open .psv2-summary { background:transparent; }
.psv2-icon { width:50px; height:50px; border-radius:14px; display:grid; place-items:center; flex-shrink:0; }
.psv2-icon svg { width:24px; height:24px; fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
.psv2-item.shop .psv2-icon { background:linear-gradient(135deg,#FED7AA,#FB923C); }
.psv2-item.shop .psv2-icon svg { stroke:#7C2D12; }
.psv2-item.partner .psv2-icon { background:linear-gradient(135deg,#BFDBFE,#60A5FA); }
.psv2-item.partner .psv2-icon svg { stroke:#1E3A8A; }
.psv2-item.show .psv2-icon { background:linear-gradient(135deg,#A7F3D0,#34D399); }
.psv2-item.show .psv2-icon svg { stroke:#064E3B; }
.psv2-summary-text { flex:1; min-width:0; }
.psv2-summary-label { display:inline-block; font-size:11px; font-weight:800; letter-spacing:0.04em; padding:3px 9px; border-radius:999px; margin-bottom:5px; }
.psv2-item.shop .psv2-summary-label { background:#FFEDD5; color:#7C2D12; }
.psv2-item.partner .psv2-summary-label { background:#DBEAFE; color:#1E3A8A; }
.psv2-item.show .psv2-summary-label { background:#D1FAE5; color:#064E3B; }
.psv2-summary-title { font-size:15px; font-weight:800; color:#0F1F5C; letter-spacing:-0.03em; line-height:1.4; }
.psv2-summary-sub { font-size:12.5px; font-weight:500; color:#9CA3AF; margin-top:3px; letter-spacing:-0.02em; }
.psv2-toggle { width:32px; height:32px; border-radius:50%; background:#F5F6F8; display:grid; place-items:center; flex-shrink:0; transition:.3s; color:#6B7280; font-size:13px; font-weight:900; line-height:1; }
.psv2-item.open .psv2-toggle { background:#E8780F; color:#fff; transform:rotate(180deg); box-shadow:0 4px 12px rgba(232,120,15,.32); }
.psv2-body { max-height:0; overflow:hidden; transition:max-height .4s ease; }
.psv2-item.open .psv2-body { max-height:600px; }
.psv2-body-inner { padding:0 22px 22px 22px; display:flex; flex-direction:column; gap:14px; }
.psv2-body-desc { font-size:13.5px; font-weight:500; color:#374151; line-height:1.7; letter-spacing:-0.02em; padding-top:6px; border-top:1px dashed #E5E7EB; padding-top:14px; }
.psv2-body-chips { display:flex; gap:6px; flex-wrap:wrap; }
.psv2-body-chip { font-size:11.5px; font-weight:700; padding:5px 11px; border-radius:999px; letter-spacing:-0.02em; }
.psv2-item.shop .psv2-body-chip { background:#FFEDD5; color:#7C2D12; border:1px solid #FED7AA; }
.psv2-item.partner .psv2-body-chip { background:#DBEAFE; color:#1E3A8A; border:1px solid #BFDBFE; }
.psv2-item.show .psv2-body-chip { background:#D1FAE5; color:#064E3B; border:1px solid #A7F3D0; }
.psv2-body-cta { display:inline-flex; align-items:center; justify-content:space-between; padding:13px 18px; border-radius:12px; font-size:13px; font-weight:800; text-decoration:none; transition:all .25s; letter-spacing:-0.02em; align-self:flex-start; min-width:240px; gap:8px; }
.psv2-body-cta::after { content:'→'; transition:transform .25s; }
.psv2-body-cta:hover::after { transform:translateX(4px); }
.psv2-item.shop .psv2-body-cta { background:#FFEDD5; color:#7C2D12; }
.psv2-item.shop .psv2-body-cta:hover { background:#F97316; color:#fff; }
.psv2-item.partner .psv2-body-cta { background:#DBEAFE; color:#1E3A8A; }
.psv2-item.partner .psv2-body-cta:hover { background:#0F1F5C; color:#fff; }
.psv2-item.show .psv2-body-cta { background:#D1FAE5; color:#064E3B; }
.psv2-item.show .psv2-body-cta:hover { background:#10B981; color:#fff; }
@media (max-width:700px) {
  .psv2 { padding:48px 14px 56px; }
  .psv2-head h2 { font-size:24px; }
  .psv2-head p { font-size:12.5px; }
  .psv2-summary { padding:15px 16px; gap:12px; }
  .psv2-icon { width:44px; height:44px; border-radius:12px; }
  .psv2-icon svg { width:22px; height:22px; }
  .psv2-summary-label { font-size:10px; padding:2px 8px; }
  .psv2-summary-title { font-size:13.5px; }
  .psv2-summary-sub { font-size:11.5px; }
  .psv2-toggle { width:28px; height:28px; font-size:11px; }
  .psv2-body-inner { padding:0 16px 18px 16px; }
  .psv2-body-desc { font-size:12.5px; }
  .psv2-body-chip { font-size:10.5px; padding:4px 9px; }
  .psv2-body-cta { width:100%; min-width:0; padding:12px 16px; font-size:12.5px; }
}
</style>
<section class="psv2">
  <div class="psv2-inner">
    <div class="psv2-head">
      <div class="kicker">SERVICE</div>
      <h2>POUR스토어 서비스 안내</h2>
      <p>탭하면 자세한 설명이 펼쳐집니다</p>
    </div>
    <div class="psv2-acc">
      <div class="psv2-item shop open" data-psv2-acc>
        <button class="psv2-summary" type="button" data-psv2-trigger>
          <div class="psv2-icon"><svg viewBox="0 0 24 24"><path d="M3 9V21h18V9"/><path d="M2 6h20l-2 3H4Z"/><path d="M16 14h-8"/></svg></div>
          <div class="psv2-summary-text">
            <span class="psv2-summary-label">대리점</span>
            <div class="psv2-summary-title">가까운 대리점에서 자재·시공을 직접 체험하세요</div>
            <div class="psv2-summary-sub">잘못된 시공·자재 걱정 없이</div>
          </div>
          <span class="psv2-toggle" aria-hidden="true">▾</span>
        </button>
        <div class="psv2-body">
          <div class="psv2-body-inner">
            <div class="psv2-body-desc">전국 POUR 대리점에서 자재 실물 확인·전문 상담·즉시 구매가 가능합니다. 가까운 매장 위치를 확인하시거나, 신규 대리점 개설을 문의해 보세요.</div>
            <div class="psv2-body-chips">
              <span class="psv2-body-chip">🏬 전국 대리점망</span>
              <span class="psv2-body-chip">🔍 자재 실물 체험</span>
              <span class="psv2-body-chip">💳 즉시 구매</span>
              <span class="psv2-body-chip">🤝 전문 상담</span>
            </div>
            <a class="psv2-body-cta" href="https://www.pourstore.net/dealers">대리점 위치 / 개설 문의</a>
          </div>
        </div>
      </div>
      <div class="psv2-item partner" data-psv2-acc>
        <button class="psv2-summary" type="button" data-psv2-trigger>
          <div class="psv2-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div class="psv2-summary-text">
            <span class="psv2-summary-label">파트너사</span>
            <div class="psv2-summary-title">유지보수 업계를 함께 이끌 파트너 모집</div>
            <div class="psv2-summary-sub">전국 250+ 시공 파트너사와 함께 성장</div>
          </div>
          <span class="psv2-toggle" aria-hidden="true">▾</span>
        </button>
        <div class="psv2-body">
          <div class="psv2-body-inner">
            <div class="psv2-body-desc">전국 250+ 시공 파트너사와 함께 성장합니다. 안정적인 발주 + 기술 교육 + 마케팅 지원으로 지역 1등 시공 파트너를 만듭니다.</div>
            <div class="psv2-body-chips">
              <span class="psv2-body-chip">전국 250+</span>
              <span class="psv2-body-chip">기술 교육</span>
              <span class="psv2-body-chip">마케팅 지원</span>
            </div>
            <a class="psv2-body-cta" href="https://www.pourstore.net/partners">파트너 신청</a>
          </div>
        </div>
      </div>
      <div class="psv2-item show" data-psv2-acc>
        <button class="psv2-summary" type="button" data-psv2-trigger>
          <div class="psv2-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></div>
          <div class="psv2-summary-text">
            <span class="psv2-summary-label">전시장 · 쇼룸</span>
            <div class="psv2-summary-title">모든 자재를 직접 체험할 수 있는 전국 쇼룸</div>
            <div class="psv2-summary-sub">실물 체험·시공 결과물·교육 콘텐츠</div>
          </div>
          <span class="psv2-toggle" aria-hidden="true">▾</span>
        </button>
        <div class="psv2-body">
          <div class="psv2-body-inner">
            <div class="psv2-body-desc">제품 실물·시공 결과물·교육 콘텐츠까지 한 공간에서 만나보세요. 방문 예약하시면 전문가가 직접 안내해드립니다.</div>
            <div class="psv2-body-chips">
              <span class="psv2-body-chip">실물 체험</span>
              <span class="psv2-body-chip">시공 사례</span>
              <span class="psv2-body-chip">교육 프로그램</span>
            </div>
            <a class="psv2-body-cta" href="https://www.pourstore.net/showroom">쇼룸 방문 예약</a>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>
  (function(){
    var root = document.currentScript && document.currentScript.parentElement;
    if (!root) return;
    var items = root.querySelectorAll('[data-psv2-acc]');
    items.forEach(function(item){
      var trigger = item.querySelector('[data-psv2-trigger]');
      if (!trigger) return;
      trigger.addEventListener('click', function(){
        var isOpen = item.classList.contains('open');
        items.forEach(function(other){ if (other !== item) other.classList.remove('open'); });
        item.classList.toggle('open', !isOpen);
      });
    });
  })();
  </script>
</section>`;

  const SEED_POSTING_HTML = `<style>
.psg3 *, .psg3 *::before, .psg3 *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
.psg3 { background:#FFFBF5; padding:72px 18px; letter-spacing:-0.02em; }
.psg3-inner { max-width:1200px; margin:0 auto; }
.psg3-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:14px; }
.psg3-head .left { flex:1; min-width:240px; }
.psg3-head .kicker { font-size:12px; font-weight:800; color:#E8780F; letter-spacing:0.06em; margin-bottom:8px; }
.psg3-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-0.045em; line-height:1.25; }
.psg3-head p { font-size:13.5px; font-weight:500; color:#6B7280; margin-top:6px; }
.psg3-head .more { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; background:#fff; border:1.5px solid #E5E7EB; border-radius:999px; color:#0F1F5C; font-size:13px; font-weight:800; text-decoration:none; transition:all .2s; letter-spacing:-0.02em; }
.psg3-head .more:hover { border-color:#0F1F5C; background:#0F1F5C; color:#fff; }
/* 데스크탑 그리드 (Feature 좌측 큰, 우측 3개) */
.psg3-grid { display:grid; grid-template-columns:1.5fr 1fr 1fr; grid-template-rows:auto auto; gap:14px; }
.psg3-list { display:contents; }
.psg3-card { background:#fff; border-radius:20px; overflow:hidden; cursor:pointer; transition:all .3s; text-decoration:none; color:inherit; display:flex; flex-direction:column; border:1px solid #F3F4F6; }
.psg3-card:hover { transform:translateY(-4px); box-shadow:0 20px 44px rgba(15,31,92,.1); border-color:transparent; }
.psg3-card.feature { grid-row:span 2; }
.psg3-card .img { background:linear-gradient(135deg,#FED7AA,#FB923C) center/cover no-repeat; position:relative; flex-shrink:0; }
.psg3-card .img::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,transparent 50%, rgba(0,0,0,.05) 100%); }
.psg3-card.feature .img { aspect-ratio:1.4/1; }
.psg3-card:not(.feature) .img { aspect-ratio:16/10; }
.psg3-card .tag { position:absolute; top:14px; left:14px; padding:5px 11px; background:rgba(15,31,92,.95); color:#fff; font-size:10.5px; font-weight:800; border-radius:6px; backdrop-filter:blur(8px); letter-spacing:0.04em; }
.psg3-card.feature .tag { background:#F97316; }
.psg3-card .meta-tl { position:absolute; bottom:14px; right:14px; display:flex; gap:6px; }
.psg3-card .meta-tl span { padding:4px 9px; background:rgba(0,0,0,.6); color:#fff; font-size:10.5px; font-weight:700; border-radius:5px; backdrop-filter:blur(4px); }
.psg3-card .body { padding:18px 20px 22px; flex:1; display:flex; flex-direction:column; }
.psg3-card.feature .body { padding:24px 26px 26px; }
.psg3-card .title { font-size:14.5px; font-weight:800; color:#0F1F5C; line-height:1.45; margin-bottom:8px; letter-spacing:-0.03em; }
.psg3-card.feature .title { font-size:20px; line-height:1.3; letter-spacing:-0.04em; }
.psg3-card .desc { font-size:12.5px; font-weight:500; color:#6B7280; line-height:1.65; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; flex:1; letter-spacing:-0.02em; }
.psg3-card.feature .desc { font-size:13.5px; -webkit-line-clamp:3; }
.psg3-card .meta-bot { display:flex; gap:10px; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid #F3F4F6; font-size:11.5px; color:#9CA3AF; font-weight:600; letter-spacing:-0.02em; }
.psg3-card .meta-bot .dot { width:3px; height:3px; background:#D1D5DB; border-radius:50%; }
/* 활성(자동 재생 중) 카드 표시 — 모바일에서만 활성화 */
.psg3-card .psg3-prog { position:absolute; left:0; right:0; bottom:0; height:3px; background:rgba(232,120,15,.15); overflow:hidden; opacity:0; transition:opacity .3s; pointer-events:none; }
.psg3-card[data-psg3-active] .psg3-prog { opacity:1; }
.psg3-card .psg3-prog::after { content:''; position:absolute; left:0; top:0; bottom:0; width:0; background:linear-gradient(90deg,#F49A3A,#E8780F); }
.psg3-card[data-psg3-active] .psg3-prog::after { animation:psg3Fill var(--psg3-d, 6s) linear forwards; }
@keyframes psg3Fill { to { width:100%; } }
.psg3-swipe { display:none; }
@keyframes psg3SwipeAr { 0%,100% { transform:translateX(0); } 50% { transform:translateX(4px); } }
/* 태블릿 */
@media (max-width:1080px) {
  .psg3-grid { grid-template-columns:1fr 1fr; }
  .psg3-card.feature { grid-row:auto; grid-column:span 2; }
  .psg3-card.feature .img { aspect-ratio:2.4/1; }
}
/* 모바일 — Feature 풀폭 + 나머지 3개 가로 스크롤 */
@media (max-width:700px) {
  .psg3 { padding:48px 0 56px; }
  .psg3-inner { max-width:none; }
  .psg3-head { padding:0 18px; margin-bottom:18px; }
  .psg3-head h2 { font-size:24px; }
  .psg3-head p { font-size:12.5px; }
  .psg3-head .more { font-size:12px; padding:9px 14px; }
  .psg3-grid { grid-template-columns:1fr; gap:14px; padding:0 18px; }
  .psg3-card.feature { grid-column:auto; }
  .psg3-card.feature .img { aspect-ratio:16/10; }
  .psg3-card.feature .body { padding:18px 20px 22px; }
  .psg3-card.feature .title { font-size:17px; }
  .psg3-card.feature .desc { font-size:13px; -webkit-line-clamp:2; }
  /* 비특집 카드 3개를 가로 스크롤 컨테이너로 */
  .psg3-list { display:flex !important; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; -ms-overflow-style:none; gap:12px; padding:0 18px 8px; margin:0 -18px; -webkit-overflow-scrolling:touch; grid-column:auto; }
  .psg3-list::-webkit-scrollbar { display:none; }
  .psg3-list .psg3-card { flex:0 0 76%; max-width:300px; scroll-snap-align:center; position:relative; transition:.25s; }
  .psg3-list .psg3-card[data-psg3-active] { outline:2px solid #E8780F; outline-offset:-2px; box-shadow:0 14px 32px rgba(232,120,15,.22); }
  .psg3-swipe { display:flex; align-items:center; justify-content:center; gap:6px; margin:6px 18px 0; font-size:12px; font-weight:700; color:#E8780F; letter-spacing:-0.02em; }
  .psg3-swipe .ar { display:inline-block; animation:psg3SwipeAr 1.3s ease-in-out infinite; }
}
</style>
<section class="psg3">
  <div class="psg3-inner">
    <div class="psg3-head">
      <div class="left">
        <div class="kicker">MAGAZINE</div>
        <h2>자사몰 매거진</h2>
        <p>시공 노하우·하자 해결 사례·트렌드 인사이트</p>
      </div>
      <a class="more" href="https://www.pourstore.net/posts">전체 보기 →</a>
    </div>
    <div class="psg3-grid">
      <a class="psg3-card feature" href="https://www.pourstore.net/posts/know-how">
        <div class="img" style="background-image:url('https://placehold.co/1200x800/8B4513/fff?text=COVER+STORY')"><span class="tag">COVER STORY</span><div class="meta-tl"><span>📖 읽기 8분</span></div></div>
        <div class="body"><div class="title">금속기와 하자, 이렇게 대응합니다 — 실제 시공자가 알려주는 5단계</div><div class="desc">금속기와 지붕 소재의 특성과 하자 발생 원인, 그리고 POUR HOOKER 시스템으로 어떻게 해결하는지 단계별로 정리했습니다.</div><div class="meta-bot"><span>POUR 편집팀</span><span class="dot"></span><span>2일 전</span><span class="dot"></span><span>👁 4.2K</span></div></div>
      </a>
      <div class="psg3-list" data-psg3-scroll>
        <a class="psg3-card" data-psg3-dur="6" href="https://www.pourstore.net/posts/silicone">
          <div class="img" style="background-image:url('https://placehold.co/600x375/D1D5DB/0F1F5C?text=SILICONE')"><span class="tag">노하우</span></div>
          <div class="body"><div class="title">실리콘이 답일까? 외벽 균열 보수의 진실</div><div class="desc">실리콘 보수의 한계와 600% 신축 하이퍼티가 답인 이유.</div><div class="meta-bot"><span>5일 전</span><span class="dot"></span><span>👁 2.1K</span></div></div>
          <span class="psg3-prog"></span>
        </a>
        <a class="psg3-card" data-psg3-dur="6" href="https://www.pourstore.net/posts/leak-fix">
          <div class="img" style="background-image:url('https://placehold.co/600x375/059669/fff?text=DIY')"><span class="tag">셀프시공</span></div>
          <div class="body"><div class="title">크랙·누수 한 방에 — 빌라 옥상 셀프 방수 후기</div><div class="desc">평택 빌라 옥상 셀프 방수 사례, 비용·시간·결과 모두 공개.</div><div class="meta-bot"><span>1주 전</span><span class="dot"></span><span>👁 3.5K</span></div></div>
          <span class="psg3-prog"></span>
        </a>
        <a class="psg3-card" data-psg3-dur="6" href="https://www.pourstore.net/posts/shingle-coat">
          <div class="img" style="background-image:url('https://placehold.co/600x375/B91C1C/fff?text=SHINGLE')"><span class="tag">슁글</span></div>
          <div class="body"><div class="title">아스팔트 슁글에 도막방수, 잘 버틸까?</div><div class="desc">경사형 지붕에 액체방수의 한계 — 시트+도료 일체화 방식이 답.</div><div class="meta-bot"><span>2주 전</span><span class="dot"></span><span>👁 1.8K</span></div></div>
          <span class="psg3-prog"></span>
        </a>
      </div>
      <div class="psg3-swipe">옆으로 밀어 더 보기 <span class="ar">→</span></div>
    </div>
  </div>
  <script>
  (function(){
    var root = document.currentScript && document.currentScript.parentElement;
    if (!root) return;
    var scroller = root.querySelector('[data-psg3-scroll]');
    if (!scroller) return;
    var cards = Array.prototype.slice.call(scroller.querySelectorAll('.psg3-card'));
    if (cards.length === 0) return;
    var current = 0, paused = false, inView = false;
    var advanceT = null, resumeT = null;
    var mq = window.matchMedia('(max-width:700px)');
    function durMs(i){
      var d = parseFloat(cards[i].getAttribute('data-psg3-dur') || '6');
      return Math.min(Math.max(d, 3), 12) * 1000;
    }
    function clearAdvance(){ if (advanceT) { clearTimeout(advanceT); advanceT = null; } }
    function activate(i){
      clearAdvance();
      current = ((i % cards.length) + cards.length) % cards.length;
      cards.forEach(function(c, idx){
        if (idx === current) {
          c.style.setProperty('--psg3-d', (durMs(current)/1000) + 's');
          c.removeAttribute('data-psg3-active');
          void c.offsetWidth;
          c.setAttribute('data-psg3-active', '');
        } else {
          c.removeAttribute('data-psg3-active');
        }
      });
      if (mq.matches) {
        try { cards[current].scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' }); }
        catch(_) { scroller.scrollLeft = cards[current].offsetLeft - (scroller.clientWidth - cards[current].clientWidth)/2; }
      }
      if (!paused && inView && !document.hidden) {
        advanceT = setTimeout(function(){ activate(current + 1); }, durMs(current));
      }
    }
    function pauseFor(ms){
      paused = true;
      clearAdvance();
      if (resumeT) clearTimeout(resumeT);
      resumeT = setTimeout(function(){ paused = false; if (inView) activate(current); }, ms || 7000);
    }
    scroller.addEventListener('touchstart', function(){ pauseFor(8000); }, {passive:true});
    scroller.addEventListener('pointerdown', function(){ pauseFor(8000); });
    scroller.addEventListener('mouseenter', function(){ pauseFor(10000); });
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) clearAdvance();
      else if (inView && !paused) activate(current);
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          inView = e.isIntersecting;
          if (inView && !paused && mq.matches) activate(current);
          else clearAdvance();
        });
      }, { threshold: 0.3 });
      io.observe(scroller);
    } else if (mq.matches) {
      inView = true; activate(0);
    }
  })();
  </script>
</section>`;

  const SEED_VIDEO_GUIDE_HTML = `<style>
.psg4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.psg4 { background:#fff; padding:80px 18px; }
.psg4-inner { max-width:1200px; margin:0 auto; }
.psg4-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:32px; flex-wrap:wrap; gap:14px; }
.psg4-head .left { flex:1; min-width:240px; }
.psg4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
.psg4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
.psg4-head p { font-size:13.5px; color:#6B7280; margin-top:8px; }
.psg4-head .more { display:inline-flex; align-items:center; gap:6px; padding:11px 18px; background:#0F1F5C; border-radius:999px; color:#fff; font-size:13px; font-weight:800; text-decoration:none; transition:all .2s; }
.psg4-head .more:hover { background:#F97316; }
.psg4-feature { display:grid; grid-template-columns:1.6fr 1fr; gap:18px; margin-bottom:18px; }
.psg4-main { aspect-ratio:16/9; border-radius:20px; overflow:hidden; cursor:pointer; position:relative; transition:all .3s; text-decoration:none; color:inherit; display:block; box-shadow:0 18px 40px rgba(15,31,92,.18); }
.psg4-main:hover { transform:translateY(-4px); box-shadow:0 24px 50px rgba(15,31,92,.25); }
.psg4-main .img { position:absolute; inset:0; background:#000 center/cover no-repeat; }
.psg4-main .img::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, transparent 40%, rgba(0,0,0,.85) 100%); }
.psg4-main .play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:84px; height:84px; background:#F97316; border-radius:50%; display:grid; place-items:center; box-shadow:0 14px 36px rgba(249,115,22,.5); transition:transform .25s; }
.psg4-main:hover .play { transform:translate(-50%,-50%) scale(1.08); }
.psg4-main .play::after { content:''; border:0 solid transparent; border-left:24px solid #fff; border-top:14px solid transparent; border-bottom:14px solid transparent; margin-left:5px; }
.psg4-main .info { position:absolute; bottom:0; left:0; right:0; padding:30px; color:#fff; z-index:1; }
.psg4-main .badge { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; background:#F97316; border-radius:6px; font-size:10.5px; font-weight:800; margin-bottom:12px; letter-spacing:.5px; }
.psg4-main h3 { font-size:24px; font-weight:900; line-height:1.3; margin-bottom:8px; letter-spacing:-.5px; }
.psg4-main p { font-size:13px; color:rgba(255,255,255,.75); line-height:1.6; }
.psg4-side { display:flex; flex-direction:column; gap:12px; }
.psg4-mini { display:flex; gap:12px; padding:12px; border-radius:14px; cursor:pointer; transition:all .25s; text-decoration:none; color:inherit; border:1px solid transparent; }
.psg4-mini:hover { background:#FFFBF5; border-color:#FED7AA; }
.psg4-mini .thumb { width:120px; aspect-ratio:16/9; border-radius:10px; background:#000 center/cover no-repeat; flex-shrink:0; position:relative; }
.psg4-mini .thumb::after { content:'▶'; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:28px; height:28px; background:rgba(255,255,255,.95); border-radius:50%; display:grid; place-items:center; font-size:10px; color:#0F1F5C; padding-left:2px; }
.psg4-mini .info { flex:1; display:flex; flex-direction:column; justify-content:center; min-width:0; }
.psg4-mini .info .sub { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:4px; }
.psg4-mini .info .title { font-size:13px; font-weight:700; color:#0F1F5C; line-height:1.45; letter-spacing:-.3px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.psg4-mini .info .meta { font-size:10.5px; color:#9CA3AF; margin-top:4px; font-weight:600; }
.psg4-swipe { display:none; }
@keyframes psg4SwipeAr { 0%,100% { transform:translateX(0); } 50% { transform:translateX(4px); } }
@keyframes psg4Nudge { 0%,100% { transform:translateX(0); } 12% { transform:translateX(-22px); } 26% { transform:translateX(0); } }
@media (prefers-reduced-motion:reduce) { .psg4-side { animation:none !important; } }
@media (max-width:880px) { .psg4-feature { grid-template-columns:1fr; } .psg4-side { flex-direction:row; overflow-x:auto; padding-bottom:8px; animation:psg4Nudge 1.6s ease 0.9s 2; } .psg4-mini { min-width:280px; } .psg4-head h2 { font-size:24px; } .psg4-swipe { display:flex; align-items:center; justify-content:center; gap:6px; margin:10px 18px 0; font-size:12px; font-weight:700; color:#E8780F; letter-spacing:-0.02em; } .psg4-swipe .ar { display:inline-block; animation:psg4SwipeAr 1.3s ease-in-out infinite; } }
@media (max-width:640px) {
  .psg4-main { aspect-ratio:4/3; }
  .psg4-main .play { width:60px; height:60px; top:34%; }
  .psg4-main .play::after { border-left:17px solid #fff; border-top:10px solid transparent; border-bottom:10px solid transparent; margin-left:4px; }
  .psg4-main .info { padding:18px; }
  .psg4-main .badge { margin-bottom:8px; }
  .psg4-main h3 { font-size:18px; }
  .psg4-main p { display:none; }
}
</style>
<section class="psg4">
  <div class="psg4-inner">
    <div class="psg4-head">
      <div class="left">
        <div class="kicker">VIDEO GUIDE</div>
        <h2>POUR스토어 동영상 가이드</h2>
        <p>시공방법부터 자재 활용 — 자사몰 자체 영상으로 정리</p>
      </div>
      <a class="more" href="https://www.pourstore.net/videos">전체 영상 →</a>
    </div>
    <div class="psg4-feature">
      <a class="psg4-main" href="https://www.pourstore.net/videos/feature">
        <div class="img" style="background-image:url('https://placehold.co/1200x675/0F1F5C/F97316?text=POUR+FEATURE')"></div>
        <div class="play"></div>
        <div class="info"><span class="badge">▶ 추천 영상</span><h3>POUR 코트재 — 시공 전 알아야 할 모든 것</h3><p>10분 안에 정리되는 코트재 시공 노하우. 바탕면 처리부터 마감까지.</p></div>
      </a>
      <div class="psg4-side">
        <a class="psg4-mini" href="https://www.pourstore.net/videos/v1"><div class="thumb" style="background-image:url('https://placehold.co/240x135/0F1F5C/fff?text=GUIDE+1')"></div><div class="info"><div class="sub">시공가이드</div><div class="title">옥상 슬라브 방수 단계별 진행 가이드</div><div class="meta">8:42 · 12K 회</div></div></a>
        <a class="psg4-mini" href="https://www.pourstore.net/videos/v2"><div class="thumb" style="background-image:url('https://placehold.co/240x135/EA580C/fff?text=AI+GUIDE')"></div><div class="info"><div class="sub">길잡이</div><div class="title">POUR 길잡이 AI 진단 사용법</div><div class="meta">5:18 · 8.2K 회</div></div></a>
        <a class="psg4-mini" href="https://www.pourstore.net/videos/v3"><div class="thumb" style="background-image:url('https://placehold.co/240x135/F97316/fff?text=CASE')"></div><div class="info"><div class="sub">시공 사례</div><div class="title">신축 정밀 자공 푸드프트정 시공 현장</div><div class="meta">12:05 · 6.5K 회</div></div></a>
        <a class="psg4-mini" href="https://www.pourstore.net/videos/v4"><div class="thumb" style="background-image:url('https://placehold.co/240x135/059669/fff?text=APT')"></div><div class="info"><div class="sub">아파트 사례</div><div class="title">구안주 아파트 단지 — 유니크하우 시공</div><div class="meta">9:33 · 4.1K 회</div></div></a>
      </div>
      <div class="psg4-swipe">옆으로 밀어 더 보기 <span class="ar">→</span></div>
    </div>
  </div>
</section>`;


  const SEED_AB_HERO_HTML = `<style>
  .pab1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pab1 { background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 100%); padding:96px 18px 72px; position:relative; overflow:hidden; }
  .pab1::before { content:''; position:absolute; top:-120px; right:-120px; width:520px; height:520px; background:radial-gradient(circle, rgba(249,115,22,.14) 0%, transparent 60%); border-radius:50%; pointer-events:none; }
  .pab1::after { content:''; position:absolute; bottom:-100px; left:-60px; width:340px; height:340px; background:radial-gradient(circle, rgba(15,31,92,.06) 0%, transparent 60%); border-radius:50%; pointer-events:none; }
  .pab1-inner { max-width:1100px; margin:0 auto; text-align:center; position:relative; z-index:1; }
  .pab1-tag { display:inline-flex; align-items:center; gap:8px; padding:6px 14px; background:#fff; border:1px solid #FED7AA; color:#EA580C; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:22px; box-shadow:0 4px 12px rgba(249,115,22,.1); }
  .pab1 h1 { font-size:48px; font-weight:900; color:#0F1F5C; line-height:1.2; margin-bottom:20px; letter-spacing:-1.4px; }
  .pab1 h1 .accent { color:#F97316; }
  .pab1-desc { font-size:16px; color:#4B5563; line-height:1.75; max-width:640px; margin:0 auto 40px; }
  .pab1-stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; max-width:880px; margin:0 auto; }
  .pab1-stat { background:#fff; border-radius:18px; padding:24px 20px; border:1px solid #F3F4F6; box-shadow:0 6px 20px rgba(15,31,92,.06); transition:transform .25s; }
  .pab1-stat:hover { transform:translateY(-4px); }
  .pab1-stat .v { font-family:'Bebas Neue',sans-serif; font-size:36px; font-weight:900; color:#F97316; letter-spacing:.5px; line-height:1; }
  .pab1-stat .l { font-size:12px; color:#6B7280; margin-top:8px; font-weight:700; letter-spacing:.3px; }
  @media (max-width:640px) { .pab1 { padding:64px 18px 48px; } .pab1 h1 { font-size:30px; } .pab1-desc { font-size:14px; } .pab1-stat .v { font-size:28px; } }
  </style>
  <section class="pab1">
    <div class="pab1-inner">
      <span class="pab1-tag">⭐ POUR스토어 브랜드 스토리</span>
      <h1>건축물 유지보수,<br/><span class="accent">기술과 친근함의 균형</span>으로</h1>
      <p class="pab1-desc">POUR스토어는 R&D 기반 건축 자재 브랜드입니다.<br/>전문 시공자에게는 검증된 자재, 일반 사용자에게는 친근한 안내를 — 그 사이의 다리가 되겠습니다.</p>
      <div class="pab1-stats">
        <div class="pab1-stat"><div class="v">2,600,000+</div><div class="l">검증된 시공 세대</div></div>
        <div class="pab1-stat"><div class="v">250+</div><div class="l">전문 파트너사</div></div>
        <div class="pab1-stat"><div class="v">70+</div><div class="l">특허·인증</div></div>
        <div class="pab1-stat"><div class="v">110+</div><div class="l">제품 라인업</div></div>
      </div>
    </div>
  </section>`;

  const SEED_AB_ABOUT_HTML = `<style>
  .pab2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pab2 { background:#fff; padding:80px 18px; }
  .pab2-inner { max-width:1100px; margin:0 auto; display:grid; grid-template-columns:1fr 1.1fr; gap:48px; align-items:center; }
  .pab2-img { aspect-ratio:4/5; background:linear-gradient(135deg,#FED7AA,#FB923C); border-radius:24px; position:relative; overflow:hidden; box-shadow:0 18px 48px rgba(249,115,22,.18); }
  .pab2-img::before { content:'POUR'; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-8deg); font-family:'Bebas Neue',sans-serif; font-size:140px; font-weight:900; color:rgba(255,255,255,.22); letter-spacing:8px; }
  .pab2-img .label { position:absolute; bottom:24px; left:24px; padding:8px 14px; background:#fff; border-radius:8px; font-size:11.5px; font-weight:800; color:#0F1F5C; box-shadow:0 6px 18px rgba(0,0,0,.12); }
  .pab2-content .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:10px; }
  .pab2-content h2 { font-size:32px; font-weight:900; color:#0F1F5C; line-height:1.25; margin-bottom:18px; letter-spacing:-1px; }
  .pab2-content p { font-size:14.5px; color:#4B5563; line-height:1.85; margin-bottom:14px; }
  .pab2-content p b { color:#0F1F5C; font-weight:800; }
  .pab2-info { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; margin-top:24px; padding-top:24px; border-top:1px solid #F3F4F6; }
  .pab2-info .item { font-size:13px; }
  .pab2-info .item .l { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:4px; }
  .pab2-info .item .v { color:#0F1F5C; font-weight:700; line-height:1.5; }
  @media (max-width:880px) { .pab2-inner { grid-template-columns:1fr; gap:32px; } .pab2-img { max-width:380px; margin:0 auto; aspect-ratio:1/1; } .pab2-img::before { font-size:90px; } .pab2-content h2 { font-size:24px; } }
  </style>
  <section class="pab2">
    <div class="pab2-inner">
      <div class="pab2-img"><span class="label">📍 본사 · 경기 평택</span></div>
      <div class="pab2-content">
        <div class="kicker">ABOUT US</div>
        <h2>건축의 기본기를<br/>다시 쓰는 회사</h2>
        <p>POUR스토어는 <b>방수·도장·균열 보수</b> 자재를 R&D부터 직접 만드는 회사입니다. 단순 유통사가 아닌 <b>제조·기술·시공 노하우</b>를 한 손에 갖춘 통합 브랜드.</p>
        <p>고층 아파트에 적합하지 않은 자재가 시공되어 후일 더 큰 문제가 되는 것을 막기 위해, <b>국내 환경에 맞춘 자재</b>를 직접 개발하기 시작했습니다.</p>
        <div class="pab2-info">
          <div class="item"><div class="l">설립</div><div class="v">2018년</div></div>
          <div class="item"><div class="l">본사</div><div class="v">경기 평택</div></div>
          <div class="item"><div class="l">사업영역</div><div class="v">자재 R&D · 제조 · 유통</div></div>
          <div class="item"><div class="l">미션</div><div class="v">건축 유지보수의 표준화</div></div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_AB_RD_HTML = `<style>
  .pab3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pab3 { background:#FFFBF5; padding:80px 18px; }
  .pab3-inner { max-width:1200px; margin:0 auto; }
  .pab3-head { text-align:center; margin-bottom:36px; }
  .pab3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pab3-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pab3-head p { font-size:14px; color:#6B7280; max-width:560px; margin:0 auto; }
  .pab3-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; }
  .pab3-card { background:#fff; border-radius:18px; padding:24px 22px; border:1px solid #F3F4F6; transition:all .25s; }
  .pab3-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.1); border-color:#FED7AA; }
  .pab3-card .icon { width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:24px; margin-bottom:14px; }
  .pab3-card .name { font-size:15.5px; font-weight:800; color:#0F1F5C; margin-bottom:8px; letter-spacing:-.3px; }
  .pab3-card .desc { font-size:12.5px; color:#6B7280; line-height:1.65; margin-bottom:12px; }
  .pab3-card .spec { display:inline-block; padding:4px 10px; background:#FFFBF5; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:800; border-radius:6px; letter-spacing:.3px; }
  @media (max-width:640px) { .pab3-head h2 { font-size:24px; } }
  </style>
  <section class="pab3">
    <div class="pab3-inner">
      <div class="pab3-head">
        <div class="kicker">CORE TECHNOLOGY · R&D</div>
        <h2>POUR가 직접 만든 핵심 기술</h2>
        <p>강남제비스코·서울과학기술대 연구진과 공동 개발한 R&D 기반 자재들</p>
      </div>
      <div class="pab3-grid">
        <div class="pab3-card"><div class="icon">🧵</div><div class="name">슈퍼복합압축시트</div><div class="desc">니들펀칭 공정으로 섬유 내 공간을 형성, 도막 방수재와 시트 간 강력한 응결력 발현.</div><span class="spec">인장강도 11.4 N/mm² · 타사 10배</span></div>
        <div class="pab3-card"><div class="icon">🛡️</div><div class="name">POUR 코트재</div><div class="desc">방수·단열·차열·중성화 방지를 한 자재로. KTR/KCL 공인시험으로 검증된 통합 코팅재.</div><span class="spec">KTR 인장강도 5.8 N/mm² · KS 4배</span></div>
        <div class="pab3-card"><div class="icon">🪝</div><div class="name">POUR HOOKER (특허)</div><div class="desc">손상된 미장 마감면에도 시공 가능. 후레싱 탈락 방지 + 일체화를 동시에.</div><span class="spec">국내 특허 등록 · 저비용 고효율</span></div>
        <div class="pab3-card"><div class="icon">💪</div><div class="name">탄성강화 파우더</div><div class="desc">마이크로 스틸 보강재 혼입 — 망치로 때려도 깨지지 않는 강도.</div><span class="spec">부착강도 1.5 N/mm² · 습윤 조건</span></div>
        <div class="pab3-card"><div class="icon">🌊</div><div class="name">POUR 하이퍼티</div><div class="desc">600%급 초고신율 고탄성 퍼티. 미세 균열·구조 변형에 유연 대응.</div><span class="spec">SGS 신장률 608% · KS 2배</span></div>
        <div class="pab3-card"><div class="icon">💨</div><div class="name">페이퍼팬벤트</div><div class="desc">콘크리트 내부 습기를 무동력으로 외부 배출 — 결로·들뜸 방지.</div><span class="spec">슬라브 듀얼강화방수 핵심 부품</span></div>
      </div>
    </div>
  </section>`;

  const SEED_AB_CERT_HTML = `<style>
  .pab4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pab4 { background:#fff; padding:80px 18px; }
  .pab4-inner { max-width:1100px; margin:0 auto; }
  .pab4-head { text-align:center; margin-bottom:32px; }
  .pab4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pab4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .pab4-head p { font-size:14px; color:#6B7280; }
  .pab4-feature { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border-radius:24px; padding:36px 32px; margin-bottom:24px; border:1px solid #FED7AA; display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
  .pab4-feature .badge { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#F97316,#EA580C); display:grid; place-items:center; flex-shrink:0; box-shadow:0 8px 20px rgba(249,115,22,.3); }
  .pab4-feature .badge svg { width:42px; height:42px; fill:#fff; }
  .pab4-feature .content { flex:1; min-width:240px; }
  .pab4-feature .label { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:5px; }
  .pab4-feature h3 { font-size:22px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.5px; }
  .pab4-feature p { font-size:13px; color:#4B5563; line-height:1.65; }
  .pab4-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; }
  .pab4-cert { background:#fff; border:1px solid #F3F4F6; border-radius:14px; padding:20px 18px; text-align:center; transition:all .25s; }
  .pab4-cert:hover { transform:translateY(-3px); box-shadow:0 12px 28px rgba(15,31,92,.08); border-color:#FED7AA; }
  .pab4-cert .seal { width:54px; height:54px; margin:0 auto 12px; border-radius:50%; background:linear-gradient(135deg,#FFFBF5,#FFEDD5); border:2px solid #FED7AA; display:grid; place-items:center; font-family:'Bebas Neue',sans-serif; font-size:13px; color:#EA580C; font-weight:900; letter-spacing:.5px; }
  .pab4-cert .name { font-size:13px; font-weight:800; color:#0F1F5C; margin-bottom:4px; }
  .pab4-cert .org { font-size:11px; color:#6B7280; }
  @media (max-width:640px) { .pab4-head h2 { font-size:24px; } .pab4-feature { padding:24px; } .pab4-feature h3 { font-size:18px; } }
  </style>
  <section class="pab4">
    <div class="pab4-inner">
      <div class="pab4-head">
        <div class="kicker">CERTIFICATIONS · PATENTS</div>
        <h2>인증·특허로 검증된 기술력</h2>
        <p>국토교통부·KTR·KCL·SGS — 공인기관에서 인정받은 자재만 사용합니다</p>
      </div>
      <div class="pab4-feature">
        <div class="badge"><svg viewBox="0 0 24 24"><path d="M12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg></div>
        <div class="content">
          <div class="label">국토교통부 지정</div>
          <h3>건설신기술 1026호</h3>
          <p>국내 최초 박공지붕 PVC 결합 방수공법 — 정부에서 검증한 신기술 공식 등록</p>
        </div>
      </div>
      <div class="pab4-grid">
        <div class="pab4-cert"><div class="seal">KTR</div><div class="name">한국화학융합시험연구원</div><div class="org">인장강도 · 부착강도</div></div>
        <div class="pab4-cert"><div class="seal">KCL</div><div class="name">한국건설생활환경시험연구원</div><div class="org">일사반사율 · 차열성</div></div>
        <div class="pab4-cert"><div class="seal">SGS</div><div class="name">SGS Korea</div><div class="org">신장률 · 내구성</div></div>
        <div class="pab4-cert"><div class="seal">건축<br/>성능원</div><div class="name">한국건축성능원</div><div class="org">방수성능 검증</div></div>
        <div class="pab4-cert"><div class="seal">70+</div><div class="name">자체 보유 특허</div><div class="org">유지보수 관련 기술</div></div>
        <div class="pab4-cert"><div class="seal">ISO</div><div class="name">ISO 9001 / 14001</div><div class="org">품질·환경 경영</div></div>
      </div>
    </div>
  </section>`;

  const SEED_AB_HISTORY_HTML = `<style>
  .pab5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pab5 { background:#FFFBF5; padding:80px 18px; }
  .pab5-inner { max-width:880px; margin:0 auto; }
  .pab5-head { text-align:center; margin-bottom:48px; }
  .pab5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pab5-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pab5-timeline { position:relative; padding-left:40px; }
  .pab5-timeline::before { content:''; position:absolute; left:14px; top:8px; bottom:8px; width:2px; background:linear-gradient(180deg,#FED7AA,#F97316,#FED7AA); }
  .pab5-item { position:relative; margin-bottom:32px; }
  .pab5-item::before { content:''; position:absolute; left:-32px; top:6px; width:14px; height:14px; border-radius:50%; background:#fff; border:3px solid #F97316; box-shadow:0 0 0 4px #FFEDD5; }
  .pab5-item .yr { font-family:'Bebas Neue',sans-serif; font-size:24px; font-weight:900; color:#F97316; letter-spacing:.5px; line-height:1; margin-bottom:6px; }
  .pab5-item h3 { font-size:16px; font-weight:800; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .pab5-item p { font-size:13.5px; color:#4B5563; line-height:1.65; }
  .pab5-item .tags { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .pab5-item .tag { padding:3px 9px; background:#fff; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:800; border-radius:5px; }
  @media (max-width:640px) { .pab5-head h2 { font-size:24px; } .pab5-timeline { padding-left:32px; } .pab5-item::before { left:-26px; } }
  </style>
  <section class="pab5">
    <div class="pab5-inner">
      <div class="pab5-head">
        <div class="kicker">OUR JOURNEY</div>
        <h2>POUR스토어의 발자취</h2>
      </div>
      <div class="pab5-timeline">
        <div class="pab5-item"><div class="yr">2025</div><h3>POUR스토어 자사몰 리뉴얼</h3><p>고객 직접 진단·구매·시공 매칭까지 한 곳에서 — AI 길잡이 시스템 도입</p><div class="tags"><span class="tag">AI 진단</span><span class="tag">자사몰 리뉴얼</span></div></div>
        <div class="pab5-item"><div class="yr">2024</div><h3>250+ 파트너사 네트워크 완성</h3><p>전국 시공 파트너사 250여 곳과 협력 체제 구축</p><div class="tags"><span class="tag">파트너 네트워크</span><span class="tag">전국 커버리지</span></div></div>
        <div class="pab5-item"><div class="yr">2023</div><h3>건설신기술 1026호 등록</h3><p>국토교통부 지정 — 국내 최초 박공지붕 PVC 결합 방수공법</p><div class="tags"><span class="tag">건설신기술</span><span class="tag">국토교통부</span></div></div>
        <div class="pab5-item"><div class="yr">2022</div><h3>누적 시공 200만 세대 돌파</h3><p>전국 아파트·관공서·일반건물 — 검증된 시공 사례 누적</p><div class="tags"><span class="tag">200만 세대</span></div></div>
        <div class="pab5-item"><div class="yr">2020</div><h3>특허 50종 돌파 · R&D 센터 확장</h3><p>강남제비스코·서울과학기술대 공동 연구 본격화</p><div class="tags"><span class="tag">R&D 확장</span><span class="tag">특허 50+</span></div></div>
        <div class="pab5-item"><div class="yr">2018</div><h3>POUR스토어 설립</h3><p>건축물 유지보수 자재 R&D 전문 기업으로 출발</p><div class="tags"><span class="tag">법인 설립</span></div></div>
      </div>
    </div>
  </section>`;

  const SEED_AB_CTA_HTML = `<style>
  .pab6 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pab6 { background:#fff; padding:80px 18px; }
  .pab6-inner { max-width:1100px; margin:0 auto; background:linear-gradient(135deg,#0F1F5C 0%,#1E3A8A 100%); border-radius:32px; padding:60px 40px; position:relative; overflow:hidden; }
  .pab6-inner::before { content:''; position:absolute; top:-80px; right:-80px; width:320px; height:320px; background:radial-gradient(circle, rgba(249,115,22,.4) 0%, transparent 60%); border-radius:50%; }
  .pab6-inner::after { content:''; position:absolute; bottom:-60px; left:-60px; width:240px; height:240px; background:radial-gradient(circle, rgba(255,255,255,.08) 0%, transparent 60%); border-radius:50%; }
  .pab6-content { position:relative; z-index:1; text-align:center; color:#fff; max-width:680px; margin:0 auto; }
  .pab6-tag { display:inline-flex; align-items:center; gap:8px; padding:6px 14px; background:rgba(249,115,22,.2); border:1px solid rgba(249,115,22,.4); color:#FED7AA; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:20px; }
  .pab6 h2 { font-size:32px; font-weight:900; color:#fff; line-height:1.3; margin-bottom:16px; letter-spacing:-1px; }
  .pab6 h2 .accent { color:#FB923C; }
  .pab6-desc { font-size:15px; color:rgba(255,255,255,.75); line-height:1.7; margin-bottom:32px; }
  .pab6-cta { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  .pab6-cta a { padding:14px 26px; border-radius:14px; font-size:14px; font-weight:800; text-decoration:none; transition:all .25s; display:inline-flex; align-items:center; gap:6px; }
  .pab6-cta .primary { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; box-shadow:0 8px 24px rgba(249,115,22,.4); }
  .pab6-cta .primary:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.55); }
  .pab6-cta .ghost { background:rgba(255,255,255,.1); color:#fff; border:1px solid rgba(255,255,255,.2); backdrop-filter:blur(8px); }
  .pab6-cta .ghost:hover { background:rgba(255,255,255,.18); }
  @media (max-width:640px) { .pab6-inner { padding:40px 24px; border-radius:24px; } .pab6 h2 { font-size:23px; } .pab6-cta a { width:100%; justify-content:center; } }
  </style>
  <section class="pab6">
    <div class="pab6-inner">
      <div class="pab6-content">
        <span class="pab6-tag">⭐ POUR스토어와 함께</span>
        <h2>건축물 유지보수의 표준,<br/><span class="accent">POUR스토어가 함께합니다</span></h2>
        <p class="pab6-desc">시공 의뢰부터 파트너 신청·쇼룸 방문까지 — 어떤 방향이든 첫 걸음을 도와드릴게요.</p>
        <div class="pab6-cta">
          <a class="primary" href="https://www.pourstore.net/consult">시공 상담 신청 →</a>
          <a class="ghost" href="https://www.pourstore.net/partners">파트너 신청</a>
          <a class="ghost" href="https://www.pourstore.net/showroom">쇼룸 방문 예약</a>
        </div>
      </div>
    </div>
  </section>`;


  const SEED_PR_NAV_HTML = `<style>
  .ppr1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppr1 { background:linear-gradient(180deg,#FFFBF5 0%,#fff 100%); padding:64px 18px 32px; }
  .ppr1-inner { max-width:1200px; margin:0 auto; }
  .ppr1-head { text-align:center; margin-bottom:28px; }
  .ppr1-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppr1-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .ppr1-head p { font-size:14px; color:#6B7280; max-width:580px; margin:0 auto; }
  .ppr1-line { display:flex; gap:8px; justify-content:center; margin-bottom:24px; flex-wrap:wrap; }
  .ppr1-line button { padding:9px 20px; background:#fff; border:1.5px solid #F3F4F6; border-radius:999px; font-size:13px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; display:inline-flex; align-items:center; gap:6px; }
  .ppr1-line button:hover { border-color:#FED7AA; color:#EA580C; }
  .ppr1-line button.active { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-color:transparent; box-shadow:0 6px 16px rgba(249,115,22,.3); }
  .ppr1-nav { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; }
  .ppr1-card { background:#fff; border:1px solid #F3F4F6; border-radius:16px; padding:22px 16px; text-align:center; transition:all .3s; cursor:pointer; text-decoration:none; position:relative; overflow:hidden; }
  .ppr1-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.1); border-color:#FED7AA; }
  .ppr1-card .icon { width:54px; height:54px; margin:0 auto 12px; border-radius:14px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:26px; transition:transform .3s; }
  .ppr1-card:hover .icon { transform:rotate(-8deg) scale(1.05); }
  .ppr1-card .name { font-size:14px; font-weight:900; color:#0F1F5C; margin-bottom:5px; letter-spacing:-.3px; }
  .ppr1-card .count { font-size:11px; color:#EA580C; font-weight:800; letter-spacing:.3px; margin-bottom:8px; }
  .ppr1-card .self { display:inline-block; padding:3px 8px; font-size:10px; font-weight:800; border-radius:5px; letter-spacing:-.2px; }
  .ppr1-card .self.ok { background:#ECFDF5; border:1px solid #A7F3D0; color:#059669; }
  .ppr1-card .self.warn { background:#FEF3C7; border:1px solid #FCD34D; color:#B45309; }
  .ppr1-card .self.pro { background:#FEE2E2; border:1px solid #FCA5A5; color:#DC2626; }
  .ppr1-card .hot { position:absolute; top:8px; right:8px; padding:2px 7px; background:#DC2626; color:#fff; font-size:9.5px; font-weight:900; border-radius:4px; letter-spacing:.3px; }
  @media (max-width:640px) { .ppr1-head h2 { font-size:24px; } }
  </style>
  <section class="ppr1">
    <div class="ppr1-inner">
      <div class="ppr1-head">
        <div class="kicker">📦 PACKAGE BY AREA</div>
        <h2>부위별 패키지 — 한 번에 끝내세요</h2>
        <p><b style="color:#0F1F5C">고품질 R&D 자재 시너지 조합 패키지</b> — 영상만 따라하면 초보자도 품질 좋은 시공 가능. 시공업자·셀프 보수 모두 자유 구매하세요</p>
      </div>
      <div class="ppr1-line">
        <button class="active">🏢 전체</button>
        <button>아파트 라인 (고층)</button>
        <button>일반 저층 (주택·상가)</button>
      </div>
      <div style="display:flex;justify-content:center;gap:14px;margin-bottom:14px;flex-wrap:wrap;font-size:11.5px;color:#6B7280;font-weight:700;">
        <span><span style="display:inline-block;width:10px;height:10px;background:#10B981;border-radius:50%;margin-right:5px;vertical-align:-1px;"></span>셀프 가능 · 평지·난간 있음</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#F59E0B;border-radius:50%;margin-right:5px;vertical-align:-1px;"></span>저층 셀프 / 고층 시공연결</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#DC2626;border-radius:50%;margin-right:5px;vertical-align:-1px;"></span>⛑️ 안전 시공 권장 · 경사·로프 (안전상)</span>
      </div>
      <div style="text-align:center;margin-bottom:18px;font-size:12px;color:#6B7280;line-height:1.65;">
        <b style="color:#0F1F5C">시공방법은 영상만 따라하면 누구나 OK</b> — R&D 고품질 자재라 가능. 시공업자는 모든 부위 자유 구매하세요.
      </div>
      <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:linear-gradient(135deg,#FEF3C7,#FFEDD5);border:1px solid #FCD34D;border-radius:14px;margin-bottom:24px;flex-wrap:wrap;">
        <div style="flex:1;min-width:220px;font-size:13px;color:#0F1F5C;line-height:1.55;font-weight:700;">
          <span style="display:inline-block;padding:3px 9px;background:#fff;border:1px solid #FCA5A5;color:#DC2626;font-size:11px;font-weight:900;border-radius:5px;margin-right:8px;">⛑️ 안전 시공 권장</span>
          안전상 셀프가 어려우시면 — <b style="color:#DC2626;">시공연결 도와드려요</b>
        </div>
        <a href="https://www.poursolution.net/163" style="padding:11px 22px;background:linear-gradient(135deg,#F97316,#EA580C);color:#fff;border-radius:10px;font-size:13px;font-weight:900;text-decoration:none;box-shadow:0 4px 14px rgba(249,115,22,.35);white-space:nowrap;">신청하기 →</a>
      </div>
      <div class="ppr1-nav">
        <a class="ppr1-card" href="#area-slab"><div class="icon">🟦</div><div class="name">슬라브</div><div class="count">패키지 6종</div><span class="self ok">✅ 셀프 OK</span><span class="hot">HOT</span></a>
        <a class="ppr1-card" href="#area-shingle"><div class="icon">🏠</div><div class="name">아스팔트 슁글</div><div class="count">패키지 4종</div><span class="self pro">⛑️ 안전 시공 권장</span></a>
        <a class="ppr1-card" href="#area-tile"><div class="icon">🧱</div><div class="name">금속 기와</div><div class="count">패키지 4종</div><span class="self pro">⛑️ 안전 시공 권장</span></a>
        <a class="ppr1-card" href="#area-crack"><div class="icon">⚡</div><div class="name">균열 보수</div><div class="count">패키지 3종</div><span class="self warn">⚠️ 저층만 셀프</span></a>
        <a class="ppr1-card" href="#area-paint"><div class="icon">🎨</div><div class="name">재도장 (외벽)</div><div class="count">패키지 5종</div><span class="self pro">⛑️ 안전 시공 권장</span><span class="hot">HOT</span></a>
        <a class="ppr1-card" href="#area-color"><div class="icon">🔩</div><div class="name">칼라강판·징크</div><div class="count">패키지 3종</div><span class="self pro">⛑️ 안전 시공 권장</span></a>
        <a class="ppr1-card" href="#area-drain"><div class="icon">🌊</div><div class="name">배수로·베란다</div><div class="count">패키지 4종</div><span class="self ok">✅ 셀프 OK</span></a>
        <a class="ppr1-card" href="#area-parking"><div class="icon">🚗</div><div class="name">지하주차장</div><div class="count">패키지 3종</div><span class="self ok">✅ 셀프 OK</span></a>
        <a class="ppr1-card" href="#area-joint"><div class="icon">🔗</div><div class="name">이음부·실링</div><div class="count">패키지 2종</div><span class="self ok">✅ 셀프 OK</span></a>
      </div>
    </div>
  </section>`;

  const SEED_PR_TIER_HTML = `<style>
  .pprt * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pprt { background:#fff; padding:80px 18px; }
  .pprt-inner { max-width:1200px; margin:0 auto; }
  .pprt-head { text-align:center; margin-bottom:36px; }
  .pprt-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pprt-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pprt-head p { font-size:14px; color:#6B7280; max-width:580px; margin:0 auto; line-height:1.65; }
  .pprt-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:24px; }
  .pprt-card { background:#fff; border:1.5px solid #F3F4F6; border-radius:20px; padding:28px 24px; transition:all .25s; position:relative; }
  .pprt-card:hover { transform:translateY(-3px); box-shadow:0 18px 40px rgba(15,31,92,.08); }
  .pprt-card.full { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border-color:#F97316; box-shadow:0 14px 36px rgba(249,115,22,.15); transform:scale(1.02); }
  .pprt-card.full::before { content:'⭐ 강력추천'; position:absolute; top:-12px; left:50%; transform:translateX(-50%); padding:6px 14px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; font-size:11px; font-weight:900; border-radius:6px; letter-spacing:.5px; box-shadow:0 4px 12px rgba(249,115,22,.4); }
  .pprt-card .head { display:flex; align-items:center; gap:12px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid rgba(249,115,22,.15); }
  .pprt-card .icon { width:48px; height:48px; border-radius:12px; background:#fff; display:grid; place-items:center; font-size:24px; flex-shrink:0; box-shadow:0 4px 10px rgba(249,115,22,.12); }
  .pprt-card.full .icon { background:linear-gradient(135deg,#F97316,#EA580C); }
  .pprt-card .label { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.8px; margin-bottom:3px; }
  .pprt-card .name { font-size:18px; font-weight:900; color:#0F1F5C; letter-spacing:-.4px; }
  .pprt-card .desc { font-size:13px; color:#4B5563; line-height:1.7; margin-bottom:14px; min-height:60px; }
  .pprt-card .desc b { color:#0F1F5C; font-weight:800; }
  .pprt-card .compose { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:14px; }
  .pprt-card .item { padding:4px 10px; background:#fff; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:800; border-radius:6px; letter-spacing:-.2px; }
  .pprt-card .item.muted { background:#F9FAFB; border-color:#E5E7EB; color:#9CA3AF; }
  .pprt-card .price { font-size:11.5px; color:#6B7280; font-weight:700; margin-bottom:14px; padding-top:14px; border-top:1px solid rgba(249,115,22,.12); display:flex; justify-content:space-between; align-items:center; }
  .pprt-card .price b { font-family:'Bebas Neue',sans-serif; font-size:18px; color:#F97316; letter-spacing:.5px; margin-right:4px; }
  .pprt-card .scope { font-size:11px; padding:4px 9px; background:#FFFBF5; border:1px solid #FED7AA; color:#EA580C; font-weight:800; border-radius:6px; letter-spacing:.3px; }
  .pprt-self { padding:12px 14px; background:#FFFBF5; border:1px dashed #FED7AA; border-radius:10px; display:flex; align-items:center; gap:10px; }
  .pprt-card.full .pprt-self { background:rgba(255,255,255,.7); border-color:#F97316; border-style:solid; }
  .pprt-self .self-icon { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:15px; flex-shrink:0; }
  .pprt-card.full .pprt-self .self-icon { background:#fff; }
  .pprt-self .self-text { flex:1; min-width:0; }
  .pprt-self .self-label { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:2px; }
  .pprt-self .self-meta { display:flex; gap:8px; font-size:11px; color:#0F1F5C; font-weight:700; flex-wrap:wrap; }
  .pprt-self .self-meta span { display:inline-flex; align-items:center; gap:3px; }
  .pprt-info { padding:18px 22px; background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border:1px solid #FED7AA; border-radius:14px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  .pprt-info .ico { font-size:24px; flex-shrink:0; }
  .pprt-info .text { flex:1; font-size:13px; color:#4B5563; line-height:1.7; min-width:240px; }
  .pprt-info .text b { color:#EA580C; font-weight:900; }
  .pprt-info .text .brand { color:#0F1F5C; font-weight:900; }
  @media (max-width:880px) { .pprt-grid { grid-template-columns:1fr; } .pprt-card.full { transform:none; } .pprt-head h2 { font-size:24px; } }
  </style>
  <section class="pprt">
    <div class="pprt-inner">
      <div class="pprt-head">
        <div class="kicker">PACKAGE TIERS</div>
        <h2>패키지 등급 — 어디까지 시공하나요?</h2>
        <p>POUR스토어 패키지는 <b style="color:#0F1F5C">시공 범위에 따라 3단계</b>로 구성됩니다. 어려운 문제는 풀패키지로 본질부터, 단순 보수는 코팅만으로도 OK.</p>
      </div>
      <div class="pprt-grid">
        <div class="pprt-card">
          <div class="head"><div class="icon">🎨</div><div><div class="label">TIER 1 · BASIC</div><div class="name">단순 코팅</div></div></div>
          <div class="desc">노후 표면 보호·재도장 같은 <b>표면 차원의 보수</b>. 빠르고 저비용 — 본질적 손상이 없을 때 권장.</div>
          <div class="compose">
            <span class="item">코트재</span>
            <span class="item muted">+ 시트</span>
            <span class="item muted">+ 보강</span>
          </div>
          <div class="price"><span><b>50</b>만원~</span><span class="scope">표면만</span></div>
          <div class="pprt-self">
            <div class="self-icon">🎬</div>
            <div class="self-text">
              <div class="self-label">포함 가이드</div>
              <div class="self-meta"><span>▶ 영상</span><span>📄 설명서</span><span>✓ 셀프 가능</span></div>
            </div>
          </div>
        </div>
        <div class="pprt-card full">
          <div class="head"><div class="icon" style="color:#fff;">🛡️</div><div><div class="label">TIER 3 · COMPLETE</div><div class="name">풀패키지</div></div></div>
          <div class="desc"><b>본질 문제까지 일괄 해결</b> — 누수·균열·결로 동시 대응. R&D 자재의 시너지로 재하자율 최소화.</div>
          <div class="compose">
            <span class="item">코트재</span>
            <span class="item">시트</span>
            <span class="item">하이퍼티</span>
            <span class="item">벤트</span>
            <span class="item">트랩</span>
          </div>
          <div class="price"><span><b>240</b>만원~</span><span class="scope">전체 부위</span></div>
          <div class="pprt-self">
            <div class="self-icon">🎬</div>
            <div class="self-text">
              <div class="self-label">포함 가이드 · 풀세트</div>
              <div class="self-meta"><span>▶ 영상 5편</span><span>📞 전화 코칭</span></div>
            </div>
          </div>
        </div>
        <div class="pprt-card">
          <div class="head"><div class="icon">🔧</div><div><div class="label">TIER 2 · PARTIAL</div><div class="name">부분 패키지</div></div></div>
          <div class="desc">균열·누수 등 <b>특정 부위의 본질 보수</b>. 코팅만으로 부족하지만 풀시공까진 과한 경우.</div>
          <div class="compose">
            <span class="item">코트재</span>
            <span class="item">하이퍼티</span>
            <span class="item">시트</span>
            <span class="item muted">+ 벤트</span>
          </div>
          <div class="price"><span><b>120</b>만원~</span><span class="scope">부분 시공</span></div>
          <div class="pprt-self">
            <div class="self-icon">🎬</div>
            <div class="self-text">
              <div class="self-label">포함 가이드</div>
              <div class="self-meta"><span>▶ 영상 3편</span><span>📄 설명서</span><span>✓ 셀프 가능</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="pprt-info">
        <div class="ico">📺</div>
        <div class="text"><b>시공방법은 영상만 따라하면 누구나 OK</b> — 고품질 R&D 자재라 가능. 시공업자에게는 빠른 시방 레퍼런스, 셀프 시공자에게는 단계별 가이드.</div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:linear-gradient(135deg,#FEF3C7,#FFEDD5);border:1px solid #FCD34D;border-radius:14px;margin-top:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:220px;font-size:13px;color:#0F1F5C;line-height:1.55;font-weight:700;">
          <span style="display:inline-block;padding:3px 9px;background:#fff;border:1px solid #FCA5A5;color:#DC2626;font-size:11px;font-weight:900;border-radius:5px;margin-right:8px;">⛑️ 안전 시공 권장</span>
          안전상 셀프가 어려우시면 — <b style="color:#DC2626;">시공연결 도와드려요</b>
        </div>
        <a href="https://www.poursolution.net/163" style="padding:11px 22px;background:linear-gradient(135deg,#F97316,#EA580C);color:#fff;border-radius:10px;font-size:13px;font-weight:900;text-decoration:none;box-shadow:0 4px 14px rgba(249,115,22,.35);white-space:nowrap;">신청하기 →</a>
      </div>
    </div>
  </section>`;

  const SEED_PR_BEST_HTML = `<style>
  .ppr2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppr2 { background:#fff; padding:72px 18px; }
  .ppr2-inner { max-width:1200px; margin:0 auto; }
  .ppr2-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:14px; }
  .ppr2-head .left { flex:1; min-width:240px; }
  .ppr2-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppr2-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:6px; }
  .ppr2-head p { font-size:13.5px; color:#6B7280; }
  .ppr2-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; transition:all .25s; }
  .ppr2-head .more:hover { background:#FFF7ED; }
  .ppr2-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:18px; }
  .ppr2-card { background:#fff; border:1.5px solid #F3F4F6; border-radius:20px; overflow:hidden; transition:all .3s; text-decoration:none; display:flex; flex-direction:column; }
  .ppr2-card:hover { transform:translateY(-4px); box-shadow:0 22px 48px rgba(15,31,92,.1); border-color:#FED7AA; }
  .ppr2-thumb { aspect-ratio:5/4; background-size:cover; background-position:center; position:relative; }
  .ppr2-thumb::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg, rgba(15,31,92,.55) 0%, transparent 50%); }
  .ppr2-thumb .rank { position:absolute; top:12px; left:12px; width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; font-family:'Bebas Neue',sans-serif; font-size:17px; font-weight:900; display:grid; place-items:center; box-shadow:0 4px 14px rgba(249,115,22,.45); letter-spacing:.5px; z-index:1; }
  .ppr2-thumb .tier { position:absolute; top:12px; right:12px; padding:5px 11px; background:rgba(15,31,92,.92); color:#fff; font-size:10.5px; font-weight:900; border-radius:6px; letter-spacing:.4px; backdrop-filter:blur(4px); z-index:1; }
  .ppr2-thumb .tier.full { background:linear-gradient(135deg,#F97316,#EA580C); }
  .ppr2-thumb .compose { position:absolute; bottom:10px; left:12px; right:12px; display:flex; flex-wrap:wrap; gap:4px; z-index:1; }
  .ppr2-thumb .compose span { padding:3px 8px; background:rgba(255,255,255,.92); color:#0F1F5C; font-size:10px; font-weight:800; border-radius:5px; letter-spacing:-.2px; backdrop-filter:blur(4px); }
  .ppr2-info { padding:16px 18px; flex:1; display:flex; flex-direction:column; }
  .ppr2-info .area { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .ppr2-info .name { font-size:15px; font-weight:900; color:#0F1F5C; margin-bottom:6px; line-height:1.35; letter-spacing:-.3px; }
  .ppr2-info .desc { font-size:11.5px; color:#6B7280; line-height:1.55; margin-bottom:12px; min-height:34px; }
  .ppr2-info .price { display:flex; align-items:baseline; gap:8px; margin-bottom:12px; }
  .ppr2-info .sale { font-size:11px; font-weight:800; color:#DC2626; }
  .ppr2-info .now { font-size:18px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; }
  .ppr2-info .meta { display:flex; align-items:center; gap:6px; font-size:11px; color:#9CA3AF; font-weight:700; margin-bottom:12px; }
  .ppr2-info .star { color:#F59E0B; }
  .ppr2-info .footer { display:flex; gap:6px; align-items:center; padding-top:12px; border-top:1px solid #F3F4F6; flex-wrap:wrap; }
  .ppr2-info .self { padding:4px 9px; font-size:10px; font-weight:800; border-radius:5px; }
  .ppr2-info .self.ok { background:#ECFDF5; border:1px solid #A7F3D0; color:#059669; }
  .ppr2-info .self.pro { background:#FEE2E2; border:1px solid #FCA5A5; color:#DC2626; }
  .ppr2-info .media { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; color:#6B7280; font-weight:700; padding:4px 9px; background:#FFFBF5; border:1px solid #FED7AA; border-radius:5px; }
  .ppr2-info .media.video { color:#EA580C; }
  @media (max-width:640px) { .ppr2-head h2 { font-size:22px; } }
  </style>
  <section class="ppr2">
    <div class="ppr2-inner">
      <div class="ppr2-head">
        <div class="left">
          <div class="kicker">⭐ BEST PACKAGES</div>
          <h2>이 달의 베스트 패키지</h2>
          <p>가장 많이 선택된 R&D 시너지 조합 패키지 — 시공 영상·설명서 포함</p>
        </div>
        <a class="more" href="https://www.pourstore.net/best">전체 패키지 →</a>
      </div>
      <div class="ppr2-grid">
        <a class="ppr2-card" href="#">
          <div class="ppr2-thumb" style="background-image:url('https://placehold.co/500x400/F97316/fff?text=SLAB+FULL')">
            <div class="rank">1</div><div class="tier full">⭐ 풀패키지</div>
            <div class="compose"><span>코트재</span><span>시트</span><span>벤트</span><span>트랩</span><span>하이퍼티</span></div>
          </div>
          <div class="ppr2-info">
            <div class="area">슬라브 · 풀패키지</div>
            <div class="name">옥상 슬라브 풀세트 — 듀얼강화방수</div>
            <div class="desc">누수·중성화·결로 동시 해결 — 약 50평형 기준</div>
            <div class="price"><span class="sale">22%</span><span class="now">240,000원~</span></div>
            <div class="meta"><span class="star">★</span><span>4.9</span><span>·</span><span>리뷰 412</span></div>
            <div class="footer"><span class="self ok">✅ 셀프 OK</span><span class="media video">▶ 영상 5편</span></div>
          </div>
        </a>
        <a class="ppr2-card" href="#">
          <div class="ppr2-thumb" style="background-image:url('https://placehold.co/500x400/EA580C/fff?text=PAINT+FULL')">
            <div class="rank">2</div><div class="tier full">⭐ 풀패키지</div>
            <div class="compose"><span>바인더</span><span>플러스</span><span>하이퍼티</span><span>HOOKER</span></div>
          </div>
          <div class="ppr2-info">
            <div class="area">외벽 재도장 · 풀패키지</div>
            <div class="name">외벽 균열 보수 + 재도장 풀세트</div>
            <div class="desc">균열 보수부터 마감 도장까지 일괄 — 고급형</div>
            <div class="price"><span class="sale">15%</span><span class="now">320,000원~</span></div>
            <div class="meta"><span class="star">★</span><span>4.8</span><span>·</span><span>리뷰 287</span></div>
            <div class="footer"><span class="self pro">⛑️ 안전 시공 권장</span><span class="media video">▶ 영상 4편</span></div>
          </div>
        </a>
        <a class="ppr2-card" href="#">
          <div class="ppr2-thumb" style="background-image:url('https://placehold.co/500x400/0F1F5C/fff?text=BERANDA')">
            <div class="rank">3</div><div class="tier">부분 패키지</div>
            <div class="compose"><span>코트재</span><span>시트</span><span>하이퍼티</span></div>
          </div>
          <div class="ppr2-info">
            <div class="area">베란다·배수로 · 부분</div>
            <div class="name">베란다 누수 · 곰팡이 셀프 키트</div>
            <div class="desc">베란다 + 배수로 보수 — 셀프 입문자 추천</div>
            <div class="price"><span class="sale">10%</span><span class="now">128,000원~</span></div>
            <div class="meta"><span class="star">★</span><span>4.9</span><span>·</span><span>리뷰 196</span></div>
            <div class="footer"><span class="self ok">✅ 셀프 OK</span><span class="media video">▶ 영상 3편</span></div>
          </div>
        </a>
        <a class="ppr2-card" href="#">
          <div class="ppr2-thumb" style="background-image:url('https://placehold.co/500x400/059669/fff?text=PARKING')">
            <div class="rank">4</div><div class="tier">부분 패키지</div>
            <div class="compose"><span>에폭시</span><span>엠보라이닝</span><span>코트재</span></div>
          </div>
          <div class="ppr2-info">
            <div class="area">지하주차장 · 부분</div>
            <div class="name">지하주차장 바닥 보수 키트</div>
            <div class="desc">에폭시 박락·미끄럼 — 약 30평 단위</div>
            <div class="price"><span class="sale">12%</span><span class="now">156,000원~</span></div>
            <div class="meta"><span class="star">★</span><span>4.7</span><span>·</span><span>리뷰 158</span></div>
            <div class="footer"><span class="self ok">✅ 셀프 OK</span><span class="media video">▶ 영상 4편</span></div>
          </div>
        </a>
      </div>
    </div>
  </section>`;

  const SEED_PR_NEW_HTML = `<style>
  .ppr3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppr3 { background:#FFFBF5; padding:72px 18px; }
  .ppr3-inner { max-width:1200px; margin:0 auto; }
  .ppr3-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:14px; }
  .ppr3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppr3-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:6px; }
  .ppr3-head p { font-size:13.5px; color:#6B7280; }
  .ppr3-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; transition:all .25s; background:#fff; }
  .ppr3-head .more:hover { background:#FFF7ED; }
  .ppr3-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; }
  .ppr3-card { background:#fff; border:1.5px solid #F3F4F6; border-radius:18px; overflow:hidden; transition:all .3s; text-decoration:none; position:relative; display:flex; flex-direction:column; }
  .ppr3-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .ppr3-thumb { aspect-ratio:5/4; background-size:cover; background-position:center; position:relative; }
  .ppr3-thumb::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg, rgba(15,31,92,.5) 0%, transparent 50%); }
  .ppr3-thumb .new { position:absolute; top:10px; left:10px; padding:4px 10px; background:#0F1F5C; color:#fff; font-size:10px; font-weight:900; border-radius:5px; letter-spacing:.5px; z-index:1; }
  .ppr3-thumb .tier { position:absolute; top:10px; right:10px; padding:4px 10px; background:rgba(255,255,255,.94); color:#0F1F5C; font-size:10px; font-weight:900; border-radius:5px; letter-spacing:.4px; z-index:1; backdrop-filter:blur(4px); }
  .ppr3-thumb .tier.full { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; }
  .ppr3-thumb .compose { position:absolute; bottom:10px; left:10px; right:10px; display:flex; flex-wrap:wrap; gap:4px; z-index:1; }
  .ppr3-thumb .compose span { padding:3px 7px; background:rgba(255,255,255,.92); color:#0F1F5C; font-size:10px; font-weight:800; border-radius:5px; letter-spacing:-.2px; }
  .ppr3-info { padding:14px 16px; flex:1; display:flex; flex-direction:column; }
  .ppr3-info .date { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.3px; margin-bottom:6px; }
  .ppr3-info .area { font-size:10.5px; font-weight:800; color:#9CA3AF; letter-spacing:.5px; margin-bottom:4px; }
  .ppr3-info .name { font-size:14.5px; font-weight:900; color:#0F1F5C; margin-bottom:6px; line-height:1.4; letter-spacing:-.3px; }
  .ppr3-info .desc { font-size:11.5px; color:#6B7280; line-height:1.55; margin-bottom:10px; }
  .ppr3-info .price { display:flex; align-items:baseline; gap:6px; margin-bottom:12px; }
  .ppr3-info .now { font-size:16px; font-weight:900; color:#0F1F5C; }
  .ppr3-info .original { font-size:11px; color:#9CA3AF; text-decoration:line-through; font-weight:600; }
  .ppr3-info .footer { display:flex; gap:6px; flex-wrap:wrap; padding-top:10px; border-top:1px solid #F3F4F6; margin-top:auto; }
  .ppr3-info .self { padding:3px 8px; font-size:10px; font-weight:800; border-radius:5px; }
  .ppr3-info .self.ok { background:#ECFDF5; border:1px solid #A7F3D0; color:#059669; }
  .ppr3-info .self.pro { background:#FEE2E2; border:1px solid #FCA5A5; color:#DC2626; }
  .ppr3-info .media { display:inline-flex; align-items:center; gap:4px; font-size:10px; color:#EA580C; font-weight:800; padding:3px 8px; background:#FFFBF5; border:1px solid #FED7AA; border-radius:5px; }
  @media (max-width:640px) { .ppr3-head h2 { font-size:22px; } }
  </style>
  <section class="ppr3">
    <div class="ppr3-inner">
      <div class="ppr3-head">
        <div>
          <div class="kicker">🆕 NEW PACKAGE</div>
          <h2>이번 주 신규 패키지</h2>
          <p>새롭게 출시된 R&D 시너지 조합 — 한정 할인가 제공</p>
        </div>
        <a class="more" href="https://www.pourstore.net/new">전체 신규 →</a>
      </div>
      <div class="ppr3-grid">
        <a class="ppr3-card" href="#">
          <div class="ppr3-thumb" style="background-image:url('https://placehold.co/500x400/F97316/fff?text=NEW+JOINT')">
            <div class="new">NEW</div><div class="tier full">⭐ 풀패키지</div>
            <div class="compose"><span>코트재</span><span>HOOKER</span><span>하이퍼티</span><span>실링재</span></div>
          </div>
          <div class="ppr3-info">
            <div class="date">2026.04.30 출시</div>
            <div class="area">이음부·실링 · 풀패키지</div>
            <div class="name">이음부 누수 풀세트 (창틀+벽체)</div>
            <div class="desc">창틀·벽체 이음부 누수 일괄 해결 — 신규</div>
            <div class="price"><span class="now">98,000원</span><span class="original">128,000원</span></div>
            <div class="footer"><span class="self ok">✅ 셀프 OK</span><span class="media">▶ 영상 4편</span></div>
          </div>
        </a>
        <a class="ppr3-card" href="#">
          <div class="ppr3-thumb" style="background-image:url('https://placehold.co/500x400/EA580C/fff?text=NEW+CRACK')">
            <div class="new">NEW</div><div class="tier">부분 패키지</div>
            <div class="compose"><span>하이퍼티</span><span>파우더</span><span>HOOKER</span></div>
          </div>
          <div class="ppr3-info">
            <div class="date">2026.04.28 출시</div>
            <div class="area">균열 보수 · 부분</div>
            <div class="name">저층 외벽 균열 셀프 보수 키트</div>
            <div class="desc">2-3층 주택 외벽 균열 — 사다리 작업 가능</div>
            <div class="price"><span class="now">86,000원</span><span class="original">110,000원</span></div>
            <div class="footer"><span class="self ok">✅ 저층 셀프</span><span class="media">▶ 영상 3편</span></div>
          </div>
        </a>
        <a class="ppr3-card" href="#">
          <div class="ppr3-thumb" style="background-image:url('https://placehold.co/500x400/0F1F5C/fff?text=NEW+ROOF')">
            <div class="new">NEW</div><div class="tier full">⭐ 풀패키지</div>
            <div class="compose"><span>코트재</span><span>슁글재</span><span>HOOKER</span><span>실링</span></div>
          </div>
          <div class="ppr3-info">
            <div class="date">2026.04.25 출시</div>
            <div class="area">아스팔트 슁글 · 풀패키지</div>
            <div class="name">박공지붕 슁글 누수 풀세트 (1026호)</div>
            <div class="desc">건설신기술 1026호 적용 — 강풍·누수 동시</div>
            <div class="price"><span class="now">186,000원</span><span class="original">240,000원</span></div>
            <div class="footer"><span class="self pro">⛑️ 안전 시공 권장</span><span class="media">▶ 영상 5편</span></div>
          </div>
        </a>
        <a class="ppr3-card" href="#">
          <div class="ppr3-thumb" style="background-image:url('https://placehold.co/500x400/059669/fff?text=NEW+VENT')">
            <div class="new">NEW</div><div class="tier">부분 패키지</div>
            <div class="compose"><span>벤트</span><span>코트재</span><span>트랩</span></div>
          </div>
          <div class="ppr3-info">
            <div class="date">2026.04.22 출시</div>
            <div class="area">슬라브 (결로 방지) · 부분</div>
            <div class="name">옥상 결로·들뜸 방지 키트</div>
            <div class="desc">페이퍼팬벤트 + 배관 트랩 신규 조합</div>
            <div class="price"><span class="now">62,000원</span><span class="original">82,000원</span></div>
            <div class="footer"><span class="self ok">✅ 셀프 OK</span><span class="media">▶ 영상 3편</span></div>
          </div>
        </a>
      </div>
    </div>
  </section>`;

  const SEED_PR_GRID_HTML = `<style>
  .ppr4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppr4 { background:#fff; padding:72px 18px; }
  .ppr4-inner { max-width:1200px; margin:0 auto; }
  .ppr4-head { text-align:center; margin-bottom:28px; }
  .ppr4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppr4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .ppr4-head p { font-size:14px; color:#6B7280; max-width:580px; margin:0 auto; }
  .ppr4-line { display:flex; gap:8px; justify-content:center; margin-bottom:28px; flex-wrap:wrap; }
  .ppr4-line button { padding:10px 20px; background:#fff; border:1.5px solid #F3F4F6; border-radius:999px; font-size:13px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; }
  .ppr4-line button:hover { border-color:#FED7AA; color:#EA580C; }
  .ppr4-line button.active { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-color:transparent; box-shadow:0 6px 16px rgba(249,115,22,.3); }
  .ppr4-section { margin-bottom:36px; }
  .ppr4-section:last-child { margin-bottom:0; }
  .ppr4-section .group-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding-bottom:12px; border-bottom:2px solid #FFEDD5; flex-wrap:wrap; }
  .ppr4-section .group-head .badge { width:36px; height:36px; border-radius:9px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:18px; flex-shrink:0; }
  .ppr4-section .group-head h3 { font-size:17px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; flex:1; }
  .ppr4-section .group-head .self { font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:5px; }
  .ppr4-section .group-head .self.ok { background:#ECFDF5; border:1px solid #A7F3D0; color:#059669; }
  .ppr4-section .group-head .self.warn { background:#FEF3C7; border:1px solid #FCD34D; color:#B45309; }
  .ppr4-section .group-head .self.pro { background:#FEE2E2; border:1px solid #FCA5A5; color:#DC2626; }
  .ppr4-row { display:grid; grid-template-columns:120px 1fr; gap:14px; margin-bottom:8px; align-items:start; }
  .ppr4-row:last-child { margin-bottom:0; }
  .ppr4-tier { padding:14px 12px; background:#FFFBF5; border:1.5px solid #F3F4F6; border-radius:12px; text-align:center; align-self:stretch; display:flex; flex-direction:column; justify-content:center; }
  .ppr4-tier.full { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border-color:#F97316; }
  .ppr4-tier .name { font-size:12px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; margin-bottom:4px; }
  .ppr4-tier.full .name { color:#EA580C; }
  .ppr4-tier .scope { font-size:10.5px; color:#9CA3AF; font-weight:700; line-height:1.4; }
  .ppr4-items { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px; }
  .ppr4-item { background:#fff; border:1px solid #F3F4F6; border-radius:10px; overflow:hidden; transition:all .25s; text-decoration:none; display:flex; }
  .ppr4-item:hover { transform:translateY(-2px); box-shadow:0 10px 20px rgba(15,31,92,.06); border-color:#FED7AA; }
  .ppr4-item .thumb { width:64px; aspect-ratio:1/1; background-size:cover; background-position:center; flex-shrink:0; }
  .ppr4-item .info { padding:8px 10px; flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center; }
  .ppr4-item .name { font-size:11.5px; font-weight:800; color:#0F1F5C; margin-bottom:3px; line-height:1.3; letter-spacing:-.3px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .ppr4-item .price { font-size:11.5px; font-weight:900; color:#EA580C; }
  .ppr4-item.empty { background:#F9FAFB; border-style:dashed; align-items:center; justify-content:center; padding:14px 10px; color:#9CA3AF; font-size:11px; font-weight:700; text-align:center; }
  .ppr4-empty-msg { padding:14px 16px; background:#F9FAFB; border:1px dashed #E5E7EB; border-radius:10px; color:#9CA3AF; font-size:11.5px; font-weight:700; text-align:center; }
  @media (max-width:640px) { .ppr4-head h2 { font-size:24px; } .ppr4-row { grid-template-columns:1fr; } .ppr4-tier { text-align:left; flex-direction:row; gap:8px; align-items:center; } }
  </style>
  <section class="ppr4">
    <div class="ppr4-inner">
      <div class="ppr4-head">
        <div class="kicker">FULL PACKAGE MATRIX</div>
        <h2>전체 패키지 매트릭스</h2>
        <p>건물 라인 × 부위 × 패키지 등급으로 한눈에 보기 — 클릭하면 상세로 이동</p>
      </div>
      <div class="ppr4-line">
        <button class="active">🏢 아파트 라인 (고층)</button>
        <button>🏠 일반 저층 (주택·상가)</button>
      </div>

      <div class="ppr4-section">
        <div class="group-head"><div class="badge">🟦</div><h3>슬라브 (옥상)</h3><span class="self ok">✅ 셀프 OK</span></div>
        <div class="ppr4-row">
          <div class="ppr4-tier full"><div class="name">⭐ 풀패키지</div><div class="scope">전체 부위</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/F97316/fff?text=APT')"></div><div class="info"><div class="name">아파트 옥상 슬라브 풀세트</div><div class="price">240,000원~</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/EA580C/fff?text=DUAL')"></div><div class="info"><div class="name">슬라브 듀얼강화 풀세트</div><div class="price">280,000원~</div></div></a>
          </div>
        </div>
        <div class="ppr4-row">
          <div class="ppr4-tier"><div class="name">부분 패키지</div><div class="scope">부분 시공</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/0F1F5C/fff?text=PART')"></div><div class="info"><div class="name">옥상 부분 보수 키트</div><div class="price">128,000원~</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/059669/fff?text=VENT')"></div><div class="info"><div class="name">결로·들뜸 방지 키트</div><div class="price">62,000원~</div></div></a>
          </div>
        </div>
        <div class="ppr4-row">
          <div class="ppr4-tier"><div class="name">단순 코팅</div><div class="scope">표면만</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/FB923C/fff?text=TOP')"></div><div class="info"><div class="name">탑코트재만 (5kg)</div><div class="price">58,000원</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/F97316/fff?text=COAT')"></div><div class="info"><div class="name">코트재만 (5kg)</div><div class="price">68,000원</div></div></a>
          </div>
        </div>
      </div>

      <div class="ppr4-section">
        <div class="group-head"><div class="badge">🏠</div><h3>아스팔트 슁글 / 금속 기와 (경사 지붕)</h3><span class="self pro">⛑️ 안전 시공 권장</span></div>
        <div class="ppr4-row">
          <div class="ppr4-tier full"><div class="name">⭐ 풀패키지</div><div class="scope">전체 부위</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/EA580C/fff?text=SHINGLE')"></div><div class="info"><div class="name">슁글 박공지붕 풀세트 (1026호)</div><div class="price">186,000원~</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/0F1F5C/fff?text=METAL')"></div><div class="info"><div class="name">금속기와 풀세트 + HOOKER</div><div class="price">198,000원~</div></div></a>
          </div>
        </div>
        <div class="ppr4-row">
          <div class="ppr4-tier"><div class="name">부분 패키지</div><div class="scope">부분 시공</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/F97316/fff?text=HOOK')"></div><div class="info"><div class="name">후레싱 보강 키트 (HOOKER)</div><div class="price">88,000원</div></div></a>
            <a class="ppr4-item empty">현재 없음</a>
          </div>
        </div>
        <div class="ppr4-row">
          <div class="ppr4-tier"><div class="name">단순 코팅</div><div class="scope">표면만</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/059669/fff?text=METAL+C')"></div><div class="info"><div class="name">금속기와 코팅재만</div><div class="price">68,000원</div></div></a>
            <a class="ppr4-item empty">현재 없음</a>
          </div>
        </div>
      </div>

      <div class="ppr4-section">
        <div class="group-head"><div class="badge">⚡</div><h3>균열 보수 / 외벽 재도장</h3><span class="self warn">⚠️ 저층만 셀프</span></div>
        <div class="ppr4-row">
          <div class="ppr4-tier full"><div class="name">⭐ 풀패키지</div><div class="scope">전체 부위</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/F97316/fff?text=PAINT')"></div><div class="info"><div class="name">외벽 재도장 풀세트 (고급형)</div><div class="price">320,000원~</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/EA580C/fff?text=MID')"></div><div class="info"><div class="name">외벽 재도장 풀세트 (중급형)</div><div class="price">240,000원~</div></div></a>
          </div>
        </div>
        <div class="ppr4-row">
          <div class="ppr4-tier"><div class="name">부분 패키지</div><div class="scope">부분 시공</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/0F1F5C/fff?text=CRACK')"></div><div class="info"><div class="name">저층 외벽 균열 셀프 키트</div><div class="price">86,000원</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/059669/fff?text=PT+CRK')"></div><div class="info"><div class="name">부분 보수 (코트재+크랙시트)</div><div class="price">112,000원</div></div></a>
          </div>
        </div>
        <div class="ppr4-row">
          <div class="ppr4-tier"><div class="name">단순 코팅</div><div class="scope">표면만</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/FB923C/fff?text=BINDER')"></div><div class="info"><div class="name">바인더+수성 (경제형)</div><div class="price">68,000원~</div></div></a>
            <a class="ppr4-item empty">현재 없음</a>
          </div>
        </div>
      </div>

      <div class="ppr4-section">
        <div class="group-head"><div class="badge">🌊</div><h3>배수로·베란다 / 지하주차장 / 이음부</h3><span class="self ok">✅ 셀프 OK</span></div>
        <div class="ppr4-row">
          <div class="ppr4-tier full"><div class="name">⭐ 풀패키지</div><div class="scope">전체 부위</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/F97316/fff?text=BERANDA')"></div><div class="info"><div class="name">베란다 누수·곰팡이 풀세트</div><div class="price">128,000원</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/EA580C/fff?text=PARK')"></div><div class="info"><div class="name">지하주차장 바닥 풀세트</div><div class="price">156,000원</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/0F1F5C/fff?text=JOINT')"></div><div class="info"><div class="name">이음부 누수 풀세트 (창틀+벽체)</div><div class="price">98,000원</div></div></a>
          </div>
        </div>
        <div class="ppr4-row">
          <div class="ppr4-tier"><div class="name">부분 패키지</div><div class="scope">부분 시공</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/059669/fff?text=DRAIN')"></div><div class="info"><div class="name">배수로 보수 키트</div><div class="price">68,000원</div></div></a>
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/FB923C/fff?text=EPOXY')"></div><div class="info"><div class="name">에폭시 부분 보수</div><div class="price">76,000원</div></div></a>
          </div>
        </div>
        <div class="ppr4-row">
          <div class="ppr4-tier"><div class="name">단순 코팅</div><div class="scope">표면만</div></div>
          <div class="ppr4-items">
            <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/100x100/F97316/fff?text=SEAL')"></div><div class="info"><div class="name">실링재만 (1kg)</div><div class="price">22,000원</div></div></a>
            <a class="ppr4-item empty">현재 없음</a>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_PR_GUIDE_HTML = `<style>
  .ppr5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppr5 { background:#FFFBF5; padding:72px 18px; }
  .ppr5-inner { max-width:1200px; margin:0 auto; }
  .ppr5-head { text-align:center; margin-bottom:28px; }
  .ppr5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppr5-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .ppr5-head p { font-size:14px; color:#6B7280; max-width:580px; margin:0 auto; }
  .ppr5-tabs { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:28px; }
  .ppr5-tab { padding:10px 20px; background:#fff; border:1.5px solid #F3F4F6; border-radius:999px; font-size:13px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; display:inline-flex; align-items:center; gap:6px; }
  .ppr5-tab:hover { border-color:#FED7AA; color:#EA580C; }
  .ppr5-tab.active { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-color:transparent; box-shadow:0 6px 16px rgba(249,115,22,.3); }
  .ppr5-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:18px; margin-bottom:32px; }
  .ppr5-feature { position:relative; aspect-ratio:16/10; border-radius:18px; overflow:hidden; background-size:cover; background-position:center; text-decoration:none; transition:transform .3s; }
  .ppr5-feature:hover { transform:translateY(-3px); }
  .ppr5-feature::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg, rgba(15,31,92,.88) 0%, rgba(15,31,92,.2) 50%, transparent 100%); }
  .ppr5-feature .play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:72px; height:72px; border-radius:50%; background:rgba(255,255,255,.95); display:grid; place-items:center; box-shadow:0 12px 32px rgba(0,0,0,.3); z-index:1; transition:transform .3s; }
  .ppr5-feature:hover .play { transform:translate(-50%,-50%) scale(1.1); }
  .ppr5-feature .play svg { width:28px; height:28px; fill:#EA580C; margin-left:4px; }
  .ppr5-feature .info { position:absolute; bottom:24px; left:24px; right:24px; z-index:1; color:#fff; }
  .ppr5-feature .badge { display:inline-block; padding:4px 10px; background:#F97316; font-size:10.5px; font-weight:900; letter-spacing:.5px; border-radius:5px; margin-bottom:10px; }
  .ppr5-feature .title { font-size:20px; font-weight:900; line-height:1.3; margin-bottom:8px; letter-spacing:-.5px; }
  .ppr5-feature .meta { font-size:12px; opacity:.9; font-weight:700; }
  .ppr5-list { display:flex; flex-direction:column; gap:12px; }
  .ppr5-mini { display:flex; gap:12px; padding:12px; background:#fff; border:1px solid #F3F4F6; border-radius:14px; transition:all .25s; text-decoration:none; }
  .ppr5-mini:hover { transform:translateX(3px); box-shadow:0 10px 24px rgba(15,31,92,.08); border-color:#FED7AA; }
  .ppr5-mini .thumb { width:120px; aspect-ratio:16/10; flex-shrink:0; border-radius:10px; background-size:cover; background-position:center; position:relative; }
  .ppr5-mini .thumb .dur { position:absolute; bottom:5px; right:5px; padding:2px 6px; background:rgba(0,0,0,.7); color:#fff; font-size:10px; font-weight:800; border-radius:4px; letter-spacing:.3px; }
  .ppr5-mini .text { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center; }
  .ppr5-mini .sub { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:4px; }
  .ppr5-mini .title { font-size:13px; font-weight:800; color:#0F1F5C; line-height:1.4; margin-bottom:4px; letter-spacing:-.3px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .ppr5-mini .meta { font-size:10.5px; color:#9CA3AF; font-weight:700; }
  .ppr5-divider { height:1px; background:linear-gradient(90deg, transparent, #FED7AA, transparent); margin:32px 0 24px; }
  .ppr5-docs-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:18px; flex-wrap:wrap; gap:12px; }
  .ppr5-docs-head .left .label { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:4px; }
  .ppr5-docs-head .left h3 { font-size:22px; font-weight:900; color:#0F1F5C; letter-spacing:-.4px; }
  .ppr5-docs-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; background:#fff; }
  .ppr5-docs { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; }
  .ppr5-doc { display:flex; gap:14px; align-items:center; padding:16px 18px; background:#fff; border:1px solid #F3F4F6; border-radius:14px; text-decoration:none; transition:all .25s; }
  .ppr5-doc:hover { transform:translateY(-2px); border-color:#FED7AA; box-shadow:0 12px 28px rgba(15,31,92,.06); }
  .ppr5-doc .pdf-icon { width:42px; height:48px; background:linear-gradient(135deg,#FEE2E2,#FECACA); border-radius:6px; display:grid; place-items:center; font-size:11px; font-weight:900; color:#DC2626; flex-shrink:0; letter-spacing:.3px; }
  .ppr5-doc .info { flex:1; min-width:0; }
  .ppr5-doc .area { font-size:10px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:3px; }
  .ppr5-doc .name { font-size:13px; font-weight:800; color:#0F1F5C; margin-bottom:4px; line-height:1.35; letter-spacing:-.3px; }
  .ppr5-doc .meta { font-size:10.5px; color:#9CA3AF; font-weight:700; }
  .ppr5-coach { margin-top:20px; padding:18px 22px; background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border:1px solid #FED7AA; border-radius:14px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  .ppr5-coach .ico { font-size:26px; flex-shrink:0; }
  .ppr5-coach .text { flex:1; font-size:13px; color:#4B5563; line-height:1.65; min-width:240px; }
  .ppr5-coach .text b { color:#0F1F5C; font-weight:900; }
  .ppr5-coach .btn { padding:10px 18px; background:#fff; border:1.5px solid #F97316; color:#EA580C; font-size:13px; font-weight:900; border-radius:10px; text-decoration:none; transition:all .2s; }
  .ppr5-coach .btn:hover { background:#F97316; color:#fff; }
  @media (max-width:880px) { .ppr5-grid { grid-template-columns:1fr; } .ppr5-head h2 { font-size:24px; } }
  </style>
  <section class="ppr5">
    <div class="ppr5-inner">
      <div class="ppr5-head">
        <div class="kicker">▶ HOW TO INSTALL</div>
        <h2>패키지별 시공 영상</h2>
        <p>모든 패키지에 영상 가이드와 전화 코칭이 포함됩니다 — 셀프 시공도, 발주 검토도 OK</p>
      </div>
      <div class="ppr5-tabs">
        <button class="ppr5-tab active">▶ 영상 가이드</button>
        <button class="ppr5-tab">📞 전화 코칭</button>
      </div>

      <div class="ppr5-grid">
        <a class="ppr5-feature" href="#" style="background-image:url('https://placehold.co/800x500/0F1F5C/fff?text=SLAB+FULL+GUIDE')">
          <div class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
          <div class="info">
            <span class="badge">⭐ FEATURED · 풀패키지</span>
            <div class="title">옥상 슬라브 풀패키지 — 시공 풀가이드 (5편)</div>
            <div class="meta">총 56분 · 조회 28K · 셀프 시공 PICK</div>
          </div>
        </a>
        <div class="ppr5-list">
          <a class="ppr5-mini" href="#"><div class="thumb" style="background-image:url('https://placehold.co/200x125/F97316/fff?text=BERANDA')"><div class="dur">22:18</div></div><div class="text"><div class="sub">베란다 풀패키지</div><div class="title">베란다 누수·곰팡이 풀시공 (3편 묶음)</div><div class="meta">조회 18K · ✅ 셀프</div></div></a>
          <a class="ppr5-mini" href="#"><div class="thumb" style="background-image:url('https://placehold.co/200x125/EA580C/fff?text=PARKING')"><div class="dur">28:45</div></div><div class="text"><div class="sub">지하주차장 풀패키지</div><div class="title">지하주차장 바닥 보수 풀가이드 (4편)</div><div class="meta">조회 12K · ✅ 셀프</div></div></a>
          <a class="ppr5-mini" href="#"><div class="thumb" style="background-image:url('https://placehold.co/200x125/059669/fff?text=JOINT')"><div class="dur">19:30</div></div><div class="text"><div class="sub">이음부 풀패키지</div><div class="title">창틀·벽체 이음부 누수 시공 (4편)</div><div class="meta">조회 9.8K · ✅ 셀프</div></div></a>
          <a class="ppr5-mini" href="#"><div class="thumb" style="background-image:url('https://placehold.co/200x125/FB923C/fff?text=CRACK')"><div class="dur">15:12</div></div><div class="text"><div class="sub">저층 외벽 균열</div><div class="title">사다리로 가능한 저층 외벽 균열 보수 (3편)</div><div class="meta">조회 8.2K · ⚠️ 저층</div></div></a>
        </div>
      </div>

      <div class="ppr5-coach">
        <div class="ico">📞</div>
        <div class="text"><b>전화 1:1 코칭 — 풀패키지 구매 시 무료</b><br>시공 중 막히는 부분이 생기면 평일 09-18시 언제든 전화. 위험한 부위라면 시공 연결 매칭으로 안내해 드려요.</div>
        <a class="btn" href="tel:1577-0000">1577-0000 →</a>
      </div>
    </div>
  </section>`;


  const SEED_CS_INTRO_HTML = `<style>
  .pcs1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pcs1 { background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 100%); padding:80px 18px 56px; position:relative; overflow:hidden; }
  .pcs1::before { content:''; position:absolute; top:-100px; right:-80px; width:380px; height:380px; background:radial-gradient(circle, rgba(249,115,22,.12) 0%, transparent 60%); border-radius:50%; }
  .pcs1-inner { max-width:1100px; margin:0 auto; text-align:center; position:relative; z-index:1; }
  .pcs1-tag { display:inline-flex; gap:6px; padding:6px 14px; background:#fff; border:1px solid #FED7AA; color:#EA580C; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:18px; box-shadow:0 4px 12px rgba(249,115,22,.1); }
  .pcs1 h1 { font-size:42px; font-weight:900; color:#0F1F5C; line-height:1.2; margin-bottom:16px; letter-spacing:-1.2px; }
  .pcs1 h1 .accent { color:#F97316; }
  .pcs1-desc { font-size:15.5px; color:#4B5563; line-height:1.75; max-width:600px; margin:0 auto 36px; }
  .pcs1-stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; max-width:780px; margin:0 auto; }
  .pcs1-stat { background:#fff; border-radius:16px; padding:20px 16px; border:1px solid #F3F4F6; box-shadow:0 6px 18px rgba(15,31,92,.05); }
  .pcs1-stat .v { font-family:'Bebas Neue',sans-serif; font-size:32px; font-weight:900; color:#F97316; line-height:1; letter-spacing:.5px; }
  .pcs1-stat .l { font-size:11.5px; color:#6B7280; margin-top:6px; font-weight:700; letter-spacing:.3px; }
  @media (max-width:640px) { .pcs1 h1 { font-size:28px; } .pcs1-desc { font-size:14px; } }
  </style>
  <section class="pcs1">
    <div class="pcs1-inner">
      <span class="pcs1-tag">📍 PROJECT CASES</span>
      <h1>전국 700+ 단지에서<br/><span class="accent">검증된 시공 사례</span></h1>
      <p class="pcs1-desc">아파트 · 관공서 · 일반건물 · 산업시설 — 다양한 환경에서 입증된 POUR 자재의 실적을 확인하세요.</p>
      <div class="pcs1-stats">
        <div class="pcs1-stat"><div class="v">700+</div><div class="l">시공 단지</div></div>
        <div class="pcs1-stat"><div class="v">2,600,000+</div><div class="l">시공 세대수</div></div>
        <div class="pcs1-stat"><div class="v">1,500,000㎡</div><div class="l">누적 시공 면적</div></div>
        <div class="pcs1-stat"><div class="v">17개</div><div class="l">전국 광역시·도</div></div>
      </div>
    </div>
  </section>`;

  const SEED_CS_FILTER_HTML = `<style>
  .pcs2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pcs2 { background:#fff; padding:48px 18px 24px; }
  .pcs2-inner { max-width:1200px; margin:0 auto; }
  .pcs2-row { margin-bottom:18px; }
  .pcs2-row:last-child { margin-bottom:0; }
  .pcs2-label { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:10px; }
  .pcs2-chips { display:flex; gap:8px; flex-wrap:wrap; }
  .pcs2-chip { padding:8px 16px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:999px; font-size:13px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; }
  .pcs2-chip:hover { border-color:#FED7AA; color:#EA580C; background:#FFF7ED; }
  .pcs2-chip.active { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-color:transparent; box-shadow:0 6px 16px rgba(249,115,22,.3); }
  .pcs2-search { display:flex; gap:8px; margin-top:18px; }
  .pcs2-search input { flex:1; padding:12px 16px; border:1px solid #F3F4F6; border-radius:12px; font-size:13.5px; font-family:inherit; background:#FFFBF5; transition:all .2s; }
  .pcs2-search input:focus { outline:none; border-color:#FED7AA; background:#fff; box-shadow:0 0 0 3px rgba(249,115,22,.08); }
  .pcs2-search button { padding:12px 24px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:12px; font-size:13.5px; font-weight:800; cursor:pointer; transition:all .2s; }
  .pcs2-search button:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(249,115,22,.35); }
  </style>
  <section class="pcs2">
    <div class="pcs2-inner">
      <div class="pcs2-row">
        <div class="pcs2-label">📍 지역별 필터</div>
        <div class="pcs2-chips">
          <button class="pcs2-chip active">전체</button>
          <button class="pcs2-chip">서울</button>
          <button class="pcs2-chip">경기</button>
          <button class="pcs2-chip">인천</button>
          <button class="pcs2-chip">부산</button>
          <button class="pcs2-chip">대구</button>
          <button class="pcs2-chip">광주</button>
          <button class="pcs2-chip">대전</button>
          <button class="pcs2-chip">울산</button>
          <button class="pcs2-chip">세종</button>
          <button class="pcs2-chip">강원</button>
          <button class="pcs2-chip">충청</button>
          <button class="pcs2-chip">전라</button>
          <button class="pcs2-chip">경상</button>
          <button class="pcs2-chip">제주</button>
        </div>
      </div>
      <div class="pcs2-row">
        <div class="pcs2-label">🏢 건물 유형</div>
        <div class="pcs2-chips">
          <button class="pcs2-chip active">전체</button>
          <button class="pcs2-chip">아파트</button>
          <button class="pcs2-chip">관공서</button>
          <button class="pcs2-chip">학교·병원</button>
          <button class="pcs2-chip">상가·오피스</button>
          <button class="pcs2-chip">공장·창고</button>
          <button class="pcs2-chip">주택</button>
        </div>
      </div>
      <div class="pcs2-search">
        <input type="text" placeholder="단지명·주소·공법으로 검색해 보세요"/>
        <button>검색</button>
      </div>
    </div>
  </section>`;

  const SEED_CS_GALLERY_HTML = `<style>
  .pcs3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pcs3 { background:#fff; padding:32px 18px 80px; }
  .pcs3-inner { max-width:1200px; margin:0 auto; }
  .pcs3-meta { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
  .pcs3-meta .count { font-size:13px; color:#6B7280; font-weight:700; }
  .pcs3-meta .count b { color:#0F1F5C; }
  .pcs3-sort { display:flex; gap:6px; }
  .pcs3-sort button { padding:6px 12px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:8px; font-size:12px; font-weight:700; color:#6B7280; cursor:pointer; }
  .pcs3-sort button.active { background:#0F1F5C; color:#fff; border-color:transparent; }
  .pcs3-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px; }
  .pcs3-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; overflow:hidden; transition:all .3s; text-decoration:none; }
  .pcs3-card:hover { transform:translateY(-4px); box-shadow:0 22px 48px rgba(15,31,92,.1); border-color:#FED7AA; }
  .pcs3-thumb { aspect-ratio:4/3; background-size:cover; background-position:center; position:relative; }
  .pcs3-thumb .badge { position:absolute; top:12px; left:12px; padding:5px 10px; background:rgba(15,31,92,.85); color:#fff; font-size:10.5px; font-weight:800; border-radius:6px; backdrop-filter:blur(4px); letter-spacing:.5px; }
  .pcs3-thumb .badge.completed { background:rgba(249,115,22,.92); }
  .pcs3-info { padding:18px; }
  .pcs3-info .region { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .pcs3-info .name { font-size:16px; font-weight:900; color:#0F1F5C; margin-bottom:8px; line-height:1.4; letter-spacing:-.3px; }
  .pcs3-info .desc { font-size:12.5px; color:#6B7280; line-height:1.6; margin-bottom:12px; min-height:40px; }
  .pcs3-info .tags { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:12px; }
  .pcs3-info .tag { padding:3px 9px; background:#FFFBF5; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:800; border-radius:5px; }
  .pcs3-info .meta { display:flex; align-items:center; justify-content:space-between; font-size:11.5px; color:#9CA3AF; font-weight:700; padding-top:12px; border-top:1px solid #F3F4F6; }
  @media (max-width:640px) { .pcs3-info .name { font-size:15px; } }
  </style>
  <section class="pcs3">
    <div class="pcs3-inner">
      <div class="pcs3-meta">
        <div class="count">총 <b>700개</b> 사례 · 표시중 <b>1-12</b></div>
        <div class="pcs3-sort">
          <button class="active">최신순</button>
          <button>규모순</button>
          <button>인기순</button>
        </div>
      </div>
      <div class="pcs3-grid">
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/F97316/fff?text=APT+ROOF')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 서울 강남구</div><div class="name">래미안 강남 옥상 슬라브 방수</div><div class="desc">2,400세대 대단지 — 슬라브 듀얼강화방수공법 + 페이퍼팬벤트 시공</div><div class="tags"><span class="tag">슬라브 방수</span><span class="tag">듀얼강화</span></div><div class="meta"><span>2025.10 완공</span><span>♡ 248</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/EA580C/fff?text=PUBLIC')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 경기 수원시</div><div class="name">수원시청 외벽 균열 보수·재도장</div><div class="desc">관공서 외벽 — 바인더+플러스 고급형 + 하이퍼티 균열 보수</div><div class="tags"><span class="tag">외벽 도장</span><span class="tag">균열 보수</span></div><div class="meta"><span>2025.09 완공</span><span>♡ 192</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/0F1F5C/fff?text=SHINGLE')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 부산 해운대구</div><div class="name">해운대 푸르지오 슁글 방수</div><div class="desc">고층 아파트 박공지붕 — 아스팔트슁글 방수공법 (1026호 신기술)</div><div class="tags"><span class="tag">슁글 방수</span><span class="tag">신기술 1026호</span></div><div class="meta"><span>2025.08 완공</span><span>♡ 287</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/059669/fff?text=PARKING')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 인천 송도</div><div class="name">송도 컨벤시아 지하주차장 에폭시</div><div class="desc">대형 컨벤션센터 지하주차장 — 에폭시 + 엠보라이닝 도장</div><div class="tags"><span class="tag">에폭시</span><span class="tag">엠보라이닝</span></div><div class="meta"><span>2025.07 완공</span><span>♡ 156</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/FB923C/fff?text=METAL')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 대구 수성구</div><div class="name">수성구 SK 금속기와 누수 보수</div><div class="desc">금속기와 지붕 누수 + 후레싱 풀림 — 금속기와 방수 + HOOKER 보강</div><div class="tags"><span class="tag">금속기와 방수</span><span class="tag">HOOKER</span></div><div class="meta"><span>2025.06 완공</span><span>♡ 134</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/F97316/fff?text=BASEMENT')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 광주 서구</div><div class="name">상무지구 오피스 지하 누수 차단</div><div class="desc">지하 1-3F 누수 — 아크릴배면차수공법 (초고압 주입)</div><div class="tags"><span class="tag">배면차수</span><span class="tag">지하 방수</span></div><div class="meta"><span>2025.05 완공</span><span>♡ 98</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/EA580C/fff?text=SCHOOL')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 대전 유성구</div><div class="name">대전 유성중 옥상 누수 보수</div><div class="desc">학교 옥상 슬라브 누수 — 우레탄 방수 + 옥상배관 트랩</div><div class="tags"><span class="tag">우레탄</span><span class="tag">배관 트랩</span></div><div class="meta"><span>2025.04 완공</span><span>♡ 112</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/0F1F5C/fff?text=ROAD')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 강원 춘천시</div><div class="name">춘천 IC 진입로 아스콘 보수</div><div class="desc">국도 포트홀 다발 구간 — POUR아스콘 + 씰코팅 + 균열 보수</div><div class="tags"><span class="tag">아스콘</span><span class="tag">씰코팅</span></div><div class="meta"><span>2025.03 완공</span><span>♡ 76</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/059669/fff?text=HOSPITAL')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 충북 청주시</div><div class="name">청주 대학병원 별관 외벽</div><div class="desc">병원 외벽 균열 + 백화 — 플러스+수성 중급형 (예산 효율)</div><div class="tags"><span class="tag">외벽 도장</span><span class="tag">중급형</span></div><div class="meta"><span>2025.02 완공</span><span>♡ 88</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/FB923C/fff?text=FACTORY')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 전남 여수시</div><div class="name">여수 산단 공장 옥상 방수</div><div class="desc">대형 공장 옥상 — 슬라브 듀얼강화 + 결로 방지 페이퍼팬벤트</div><div class="tags"><span class="tag">슬라브 방수</span><span class="tag">결로 방지</span></div><div class="meta"><span>2025.01 완공</span><span>♡ 64</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/F97316/fff?text=APT2')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 경남 창원시</div><div class="name">창원 사파동 자이 외벽 재도장</div><div class="desc">15년차 아파트 — 바인더+수성 경제형 (전체 단지 일괄)</div><div class="tags"><span class="tag">외벽 재도장</span><span class="tag">경제형</span></div><div class="meta"><span>2024.12 완공</span><span>♡ 142</span></div></div></a>
        <a class="pcs3-card" href="#"><div class="pcs3-thumb" style="background-image:url('https://placehold.co/600x450/EA580C/fff?text=JEJU')"><div class="badge completed">시공 완료</div></div><div class="pcs3-info"><div class="region">📍 제주 제주시</div><div class="name">제주공항 인근 호텔 옥상</div><div class="desc">강풍·염해 환경 — 슬라브 듀얼강화 + 차열 코트재 (KCL 91.8%)</div><div class="tags"><span class="tag">차열</span><span class="tag">염해 대응</span></div><div class="meta"><span>2024.11 완공</span><span>♡ 178</span></div></div></a>
      </div>
    </div>
  </section>`;

  const SEED_CS_BYMETHOD_HTML = `<style>
  .pcs4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pcs4 { background:#FFFBF5; padding:80px 18px; }
  .pcs4-inner { max-width:1200px; margin:0 auto; }
  .pcs4-head { text-align:center; margin-bottom:36px; }
  .pcs4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pcs4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .pcs4-head p { font-size:14px; color:#6B7280; max-width:560px; margin:0 auto; }
  .pcs4-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; }
  .pcs4-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:24px 22px; transition:all .25s; text-decoration:none; display:block; }
  .pcs4-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.1); border-color:#FED7AA; }
  .pcs4-card .icon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:26px; margin-bottom:14px; }
  .pcs4-card .name { font-size:16px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .pcs4-card .count { font-size:11.5px; font-weight:800; color:#EA580C; margin-bottom:10px; letter-spacing:.3px; }
  .pcs4-card .desc { font-size:12.5px; color:#6B7280; line-height:1.65; margin-bottom:14px; }
  .pcs4-card .arrow { font-size:12px; font-weight:800; color:#0F1F5C; transition:transform .25s; }
  .pcs4-card:hover .arrow { transform:translateX(4px); color:#EA580C; }
  @media (max-width:640px) { .pcs4-head h2 { font-size:24px; } }
  </style>
  <section class="pcs4">
    <div class="pcs4-inner">
      <div class="pcs4-head">
        <div class="kicker">BY METHOD</div>
        <h2>공법별 시공 사례</h2>
        <p>관심 있는 공법을 선택하면 해당 사례만 모아볼 수 있어요</p>
      </div>
      <div class="pcs4-grid">
        <a class="pcs4-card" href="#"><div class="icon">💧</div><div class="name">슬라브 듀얼강화방수</div><div class="count">182건 사례</div><div class="desc">옥상 슬라브 누수 + 콘크리트 중성화 → 6가지 핵심 방안 일체 시공</div><div class="arrow">사례 보기 →</div></a>
        <a class="pcs4-card" href="#"><div class="icon">🏠</div><div class="name">아스팔트슁글 방수</div><div class="count">96건 사례</div><div class="desc">건설신기술 1026호 — 박공지붕 누수·강풍 탈락 동시 해결</div><div class="arrow">사례 보기 →</div></a>
        <a class="pcs4-card" href="#"><div class="icon">🔩</div><div class="name">금속기와 방수</div><div class="count">78건 사례</div><div class="desc">맞물림 풀림·강판 부식 — POUR HOOKER 후레싱 보강 동반</div><div class="arrow">사례 보기 →</div></a>
        <a class="pcs4-card" href="#"><div class="icon">🎨</div><div class="name">외벽 균열 보수·재도장</div><div class="count">152건 사례</div><div class="desc">고급/중급/경제형 — 예산에 따라 3단계 차등 적용</div><div class="arrow">사례 보기 →</div></a>
        <a class="pcs4-card" href="#"><div class="icon">🚗</div><div class="name">에폭시·엠보라이닝</div><div class="count">68건 사례</div><div class="desc">지하주차장 바닥 — 미끄럼 저항 83 BPN MMA 공법 포함</div><div class="arrow">사례 보기 →</div></a>
        <a class="pcs4-card" href="#"><div class="icon">🌊</div><div class="name">아크릴 배면차수</div><div class="count">42건 사례</div><div class="desc">지하·수조 누수 — 탄성 아크릴 초고압 주입으로 새 방수층</div><div class="arrow">사례 보기 →</div></a>
        <a class="pcs4-card" href="#"><div class="icon">🛣️</div><div class="name">아스콘 도로 포장</div><div class="count">36건 사례</div><div class="desc">포트홀·균열 보수 + 씰코팅 — 도로 생애주기 연장</div><div class="arrow">사례 보기 →</div></a>
        <a class="pcs4-card" href="#"><div class="icon">🛡️</div><div class="name">보수·보강 (단면 복구)</div><div class="count">46건 사례</div><div class="desc">박락·철근 노출 — 탄성강화 파우더로 단면 복구</div><div class="arrow">사례 보기 →</div></a>
      </div>
    </div>
  </section>`;

  const SEED_CS_REVIEW_HTML = `<style>
  .pcs5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pcs5 { background:#fff; padding:80px 18px; }
  .pcs5-inner { max-width:1200px; margin:0 auto; }
  .pcs5-head { text-align:center; margin-bottom:36px; }
  .pcs5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pcs5-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pcs5-head .score { display:inline-flex; align-items:center; gap:8px; padding:8px 16px; background:#FFFBF5; border:1px solid #FED7AA; border-radius:999px; font-size:13px; font-weight:800; color:#EA580C; }
  .pcs5-head .score b { font-family:'Bebas Neue',sans-serif; font-size:18px; }
  .pcs5-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px; }
  .pcs5-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:24px 22px; position:relative; transition:all .25s; }
  .pcs5-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.08); border-color:#FED7AA; }
  .pcs5-card::before { content:'"'; position:absolute; top:8px; right:18px; font-family:Georgia,serif; font-size:64px; color:#FED7AA; line-height:1; opacity:.6; }
  .pcs5-card .stars { font-size:13px; color:#F59E0B; margin-bottom:10px; letter-spacing:1px; }
  .pcs5-card .text { font-size:13.5px; color:#374151; line-height:1.7; margin-bottom:18px; min-height:84px; }
  .pcs5-card .author { display:flex; align-items:center; gap:10px; padding-top:14px; border-top:1px solid #F3F4F6; }
  .pcs5-card .avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:14px; font-weight:900; color:#EA580C; }
  .pcs5-card .info { flex:1; min-width:0; }
  .pcs5-card .name { font-size:13px; font-weight:800; color:#0F1F5C; margin-bottom:2px; }
  .pcs5-card .role { font-size:11px; color:#9CA3AF; font-weight:700; }
  @media (max-width:640px) { .pcs5-head h2 { font-size:24px; } }
  </style>
  <section class="pcs5">
    <div class="pcs5-inner">
      <div class="pcs5-head">
        <div class="kicker">CUSTOMER VOICE</div>
        <h2>실제 시공 후기</h2>
        <div class="score">⭐ 평균 만족도 <b>4.9</b> / 5.0 · 누적 후기 320+</div>
      </div>
      <div class="pcs5-grid">
        <div class="pcs5-card"><div class="stars">★★★★★</div><div class="text">10년 묵은 옥상 누수가 한 번에 잡혔습니다. 작업자분들도 친절하시고, 시공 후 1년 지났는데 아직도 깨끗합니다. 이번엔 외벽도 맡기려고요.</div><div class="author"><div class="avatar">김</div><div class="info"><div class="name">김○○ 관리소장</div><div class="role">서울 강남 · 아파트 1,200세대</div></div></div></div>
        <div class="pcs5-card"><div class="stars">★★★★★</div><div class="text">관공서 발주 첫 경험이었는데, 시방서·견적·일정 안내가 명확해서 결재 올리기 편했어요. 시공 결과도 KTR 시험 수치 그대로 검증됐습니다.</div><div class="author"><div class="avatar">박</div><div class="info"><div class="name">박○○ 시설팀장</div><div class="role">경기 수원 · 시청사</div></div></div></div>
        <div class="pcs5-card"><div class="stars">★★★★★</div><div class="text">슁글 지붕 누수가 워낙 까다로워서 다른 곳에서 거절당했는데, POUR가 1026호 신기술로 해결해주셨어요. 강풍에도 끄떡없습니다.</div><div class="author"><div class="avatar">이</div><div class="info"><div class="name">이○○ 입주자대표</div><div class="role">부산 해운대 · 23층 아파트</div></div></div></div>
        <div class="pcs5-card"><div class="stars">★★★★★</div><div class="text">병원 운영 멈출 수 없어서 야간·주말 시공 요청드렸는데 일정 100% 맞춰주셨습니다. 환자분들 동선 배려도 좋았어요.</div><div class="author"><div class="avatar">최</div><div class="info"><div class="name">최○○ 시설책임자</div><div class="role">충북 청주 · 종합병원</div></div></div></div>
        <div class="pcs5-card"><div class="stars">★★★★★</div><div class="text">지하주차장 바닥이 자꾸 까지고 미끄러워서 입주민 항의 많았는데, 엠보라이닝 시공 후 항의가 0건. 데이터로 보여드릴 수 있어 좋네요.</div><div class="author"><div class="avatar">정</div><div class="info"><div class="name">정○○ 관리소장</div><div class="role">인천 송도 · 오피스텔</div></div></div></div>
        <div class="pcs5-card"><div class="stars">★★★★★</div><div class="text">공장 옥상 결로로 매년 골치였는데 페이퍼팬벤트 추가하니 완전 해결. 추가 시공도 다 POUR로 가려고 합니다.</div><div class="author"><div class="avatar">조</div><div class="info"><div class="name">조○○ 공장장</div><div class="role">전남 여수 · 산업단지</div></div></div></div>
      </div>
    </div>
  </section>`;


  const SEED_CT_FORM_HTML = `<style>
  .pct1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pct1 { background:linear-gradient(180deg,#FFFBF5 0%,#fff 100%); padding:80px 18px; }
  .pct1-inner { max-width:980px; margin:0 auto; }
  .pct1-head { text-align:center; margin-bottom:32px; }
  .pct1-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pct1-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pct1-head p { font-size:14px; color:#6B7280; }
  .pct1-card { background:#fff; border:1px solid #F3F4F6; border-radius:24px; padding:36px 32px; box-shadow:0 12px 36px rgba(15,31,92,.06); }
  .pct1-types { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px; margin-bottom:24px; }
  .pct1-type { padding:14px 12px; background:#FFFBF5; border:1.5px solid #F3F4F6; border-radius:12px; text-align:center; cursor:pointer; transition:all .2s; }
  .pct1-type:hover { border-color:#FED7AA; }
  .pct1-type.active { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border-color:#F97316; }
  .pct1-type .icon { font-size:22px; margin-bottom:4px; }
  .pct1-type .label { font-size:12.5px; font-weight:800; color:#0F1F5C; letter-spacing:-.3px; }
  .pct1-type.active .label { color:#EA580C; }
  .pct1-row { margin-bottom:16px; }
  .pct1-row.split { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .pct1-row label { display:block; font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .pct1-row input, .pct1-row textarea, .pct1-row select { width:100%; padding:12px 14px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:10px; font-size:14px; font-family:inherit; color:#0F1F5C; transition:all .2s; }
  .pct1-row textarea { min-height:120px; resize:vertical; }
  .pct1-row input:focus, .pct1-row textarea:focus, .pct1-row select:focus { outline:none; border-color:#FED7AA; background:#fff; box-shadow:0 0 0 3px rgba(249,115,22,.08); }
  .pct1-agree { display:flex; align-items:center; gap:8px; margin-bottom:18px; padding:14px; background:#FFFBF5; border-radius:10px; font-size:12.5px; color:#4B5563; }
  .pct1-agree input { width:16px; height:16px; accent-color:#F97316; }
  .pct1-agree a { color:#EA580C; font-weight:800; text-decoration:none; }
  .pct1-submit { width:100%; padding:16px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; }
  .pct1-submit:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  @media (max-width:640px) { .pct1-card { padding:24px 18px; } .pct1-row.split { grid-template-columns:1fr; } .pct1-head h2 { font-size:24px; } }
  </style>
  <section class="pct1">
    <div class="pct1-inner">
      <div class="pct1-head">
        <div class="kicker">CONTACT US</div>
        <h2>POUR스토어에 문의하기</h2>
        <p>제품·시공·파트너십 — 어떤 문의든 24시간 내 답변드립니다</p>
      </div>
      <form class="pct1-card" id="pct1-form" onsubmit="return false;">
        <div class="pct1-types" id="pct1-types">
          <div class="pct1-type active" data-v="제품 문의"><div class="icon">📦</div><div class="label">제품 문의</div></div>
          <div class="pct1-type" data-v="시공 문의"><div class="icon">🔧</div><div class="label">시공 문의</div></div>
          <div class="pct1-type" data-v="셀프 시공"><div class="icon">🛠️</div><div class="label">셀프시공</div></div>
          <div class="pct1-type" data-v="기타"><div class="icon">💬</div><div class="label">기타</div></div>
        </div>
        <div class="pct1-row split">
          <div><label>성함 *</label><input type="text" id="pct1-name" placeholder="홍길동"/></div>
          <div><label>연락처 *</label><input type="text" id="pct1-phone" placeholder="010-0000-0000"/></div>
        </div>
        <div class="pct1-row"><label>이메일</label><input type="email" id="pct1-email" placeholder="example@email.com"/></div>
        <div class="pct1-row split">
          <div><label>건물 유형</label><select id="pct1-building"><option value="">선택해 주세요</option><option>아파트</option><option>관공서</option><option>일반건물</option><option>주택</option><option>기타</option></select></div>
          <div><label>지역</label><select id="pct1-region"><option value="">선택해 주세요</option><option>서울</option><option>경기</option><option>인천</option><option>부산</option><option>기타</option></select></div>
        </div>
        <div class="pct1-row"><label>문의 내용</label><textarea id="pct1-msg-text" placeholder="문제 부위·증상·시급도 등을 자유롭게 적어주세요"></textarea></div>
        <div class="pct1-agree"><input type="checkbox" id="ag"/><label for="ag">개인정보 수집·이용에 동의합니다 <a href="#">(자세히)</a></label></div>
        <div id="pct1-msg" style="display:none;margin-bottom:10px;padding:12px 14px;border-radius:9px;font-size:13px;font-weight:700;"></div>
        <button type="button" id="pct1-submit-btn" class="pct1-submit">문의 보내기</button>
      </form>
    </div>
  </section>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script>
(function(){
  if (!window.firebase) { console.warn('[pct1] Firebase SDK 로드 실패'); return; }
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU',
      authDomain: 'pour-app-new.firebaseapp.com',
      projectId: 'pour-app-new',
      storageBucket: 'pour-app-new.firebasestorage.app',
      messagingSenderId: '411031141847',
      appId: '1:411031141847:web:e658174fd4b9652cdadf92'
    });
  }
  var db = firebase.firestore();
  var root = document.querySelector('.pct1');
  if (!root) return;

  // 문의 유형 칩 단일 선택
  root.querySelectorAll('#pct1-types .pct1-type').forEach(function(b){
    b.addEventListener('click', function(){
      root.querySelectorAll('#pct1-types .pct1-type').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
    });
  });

  function showMsg(text, type){
    var el = root.querySelector('#pct1-msg');
    el.textContent = text;
    el.style.display = 'block';
    if (type === 'success') { el.style.background = '#ECFDF5'; el.style.border = '1px solid #A7F3D0'; el.style.color = '#047857'; }
    else { el.style.background = '#FEE2E2'; el.style.border = '1px solid #FCA5A5'; el.style.color = '#DC2626'; }
  }

  root.querySelector('#pct1-submit-btn').addEventListener('click', async function(){
    var name = root.querySelector('#pct1-name').value.trim();
    var phone = root.querySelector('#pct1-phone').value.trim();
    var agree = root.querySelector('#ag').checked;
    if (!name || !phone) { showMsg('성함과 연락처는 필수입니다', 'error'); return; }
    if (!agree) { showMsg('개인정보 수집·이용 동의가 필요합니다', 'error'); return; }

    var typeEl = root.querySelector('#pct1-types .pct1-type.active');
    var data = {
      customerName: name,
      customerPhone: phone,
      customerEmail: root.querySelector('#pct1-email').value.trim(),
      category: typeEl ? typeEl.dataset.v : '기타',
      buildingType: root.querySelector('#pct1-building').value || '',
      region: root.querySelector('#pct1-region').value || '',
      message: root.querySelector('#pct1-msg-text').value.trim(),
      status: '신규',
      channel: 'pourstore-site',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    var btn = root.querySelector('#pct1-submit-btn');
    btn.disabled = true; btn.textContent = '전송 중...';
    try {
      await db.collection('site-inquiries').add(data);
      showMsg('✅ 문의가 접수되었습니다. 담당자가 빠르게 답변드릴게요.', 'success');
      btn.textContent = '✓ 전송 완료';
      setTimeout(function(){ root.querySelector('#pct1-form').reset(); btn.disabled = false; btn.textContent = '문의 보내기'; root.querySelector('#pct1-msg').style.display = 'none'; }, 4000);
    } catch (e) {
      console.error('[pct1]', e);
      showMsg('❌ 전송 실패: ' + e.message + ' — 잠시 후 다시 시도해 주세요', 'error');
      btn.disabled = false; btn.textContent = '문의 보내기';
    }
  });
})();
</script>`;

  const SEED_CT_STORE_HTML = `<style>
  .pct2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pct2 { background:#fff; padding:64px 18px; }
  .pct2-inner { max-width:1100px; margin:0 auto; }
  .pct2-head { text-align:center; margin-bottom:32px; }
  .pct2-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pct2-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pct2-grid { display:grid; grid-template-columns:1.2fr 1fr; gap:20px; }
  .pct2-info { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border:1px solid #FED7AA; border-radius:20px; padding:32px 28px; }
  .pct2-info .label { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:6px; }
  .pct2-info h3 { font-size:22px; font-weight:900; color:#0F1F5C; letter-spacing:-.5px; margin-bottom:18px; }
  .pct2-row { display:flex; align-items:flex-start; gap:14px; padding:14px 0; border-bottom:1px solid rgba(249,115,22,.15); }
  .pct2-row:last-child { border-bottom:none; }
  .pct2-row .icon { width:36px; height:36px; border-radius:10px; background:#fff; display:grid; place-items:center; font-size:16px; flex-shrink:0; box-shadow:0 4px 10px rgba(249,115,22,.1); }
  .pct2-row .text { flex:1; }
  .pct2-row .ttl { font-size:11px; font-weight:800; color:#9CA3AF; letter-spacing:.5px; margin-bottom:3px; }
  .pct2-row .v { font-size:14px; font-weight:800; color:#0F1F5C; line-height:1.5; letter-spacing:-.3px; }
  .pct2-row .v.big { font-family:'Bebas Neue',sans-serif; font-size:20px; color:#F97316; letter-spacing:.5px; }
  .pct2-map { aspect-ratio:1/1; border-radius:20px; background-image:url('https://placehold.co/600x600/0F1F5C/fff?text=MAP+VIEW'); background-size:cover; background-position:center; position:relative; overflow:hidden; }
  .pct2-map .overlay { position:absolute; bottom:18px; left:18px; right:18px; padding:14px 16px; background:rgba(255,255,255,.96); border-radius:14px; backdrop-filter:blur(8px); box-shadow:0 8px 24px rgba(0,0,0,.15); }
  .pct2-map .overlay .ttl { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:3px; }
  .pct2-map .overlay .v { font-size:13px; font-weight:800; color:#0F1F5C; }
  .pct2-map .pin { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:38px; filter:drop-shadow(0 6px 12px rgba(0,0,0,.3)); }
  @media (max-width:880px) { .pct2-grid { grid-template-columns:1fr; } .pct2-head h2 { font-size:22px; } }
  </style>
  <section class="pct2">
    <div class="pct2-inner">
      <div class="pct2-head">
        <div class="kicker">📍 STORE INFO</div>
        <h2>본사·매장 정보</h2>
      </div>
      <div class="pct2-grid">
        <div class="pct2-info">
          <div class="label">HEAD OFFICE</div>
          <h3>POUR스토어 본사 · 평택</h3>
          <div class="pct2-row"><div class="icon">📞</div><div class="text"><div class="ttl">대표 전화</div><div class="v big">1577-0000</div></div></div>
          <div class="pct2-row"><div class="icon">⏰</div><div class="text"><div class="ttl">운영 시간</div><div class="v">평일 09:00 - 18:00<br/>점심 12:30 - 13:30 · 주말·공휴일 휴무</div></div></div>
          <div class="pct2-row"><div class="icon">📧</div><div class="text"><div class="ttl">이메일</div><div class="v">contact@pourstore.net</div></div></div>
          <div class="pct2-row"><div class="icon">📍</div><div class="text"><div class="ttl">본사 주소</div><div class="v">경기도 평택시 ○○로 ○○ (○○동)<br/>POUR스토어 R&D 센터 1층</div></div></div>
        </div>
        <div class="pct2-map"><div class="pin">📍</div><div class="overlay"><div class="ttl">SHOWROOM</div><div class="v">평택 본사 1층 쇼룸 · 도보 5분 내 주차장</div></div></div>
      </div>
    </div>
  </section>`;

  const SEED_CT_KAKAO_HTML = `<style>
  .pct3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pct3 { background:#FFFBF5; padding:64px 18px; }
  .pct3-inner { max-width:980px; margin:0 auto; }
  .pct3-card { background:linear-gradient(135deg,#FEE500 0%,#FFD600 100%); border-radius:24px; padding:40px 36px; display:grid; grid-template-columns:1fr auto; gap:28px; align-items:center; box-shadow:0 18px 48px rgba(254,229,0,.3); position:relative; overflow:hidden; }
  .pct3-card::before { content:''; position:absolute; top:-60px; right:-60px; width:240px; height:240px; background:radial-gradient(circle, rgba(255,255,255,.4) 0%, transparent 60%); border-radius:50%; }
  .pct3-content { position:relative; z-index:1; }
  .pct3-content .label { display:inline-block; padding:5px 12px; background:#0F1F5C; color:#FEE500; font-size:11px; font-weight:900; border-radius:6px; letter-spacing:.5px; margin-bottom:14px; }
  .pct3-content h2 { font-size:26px; font-weight:900; color:#0F1F5C; line-height:1.3; margin-bottom:10px; letter-spacing:-.6px; }
  .pct3-content p { font-size:14px; color:#3A2A00; line-height:1.65; margin-bottom:8px; opacity:.85; }
  .pct3-content .stats { display:flex; gap:18px; margin-top:18px; flex-wrap:wrap; }
  .pct3-content .stat { font-size:12px; color:#3A2A00; font-weight:800; }
  .pct3-content .stat b { color:#0F1F5C; font-size:14px; }
  .pct3-cta { position:relative; z-index:1; display:flex; flex-direction:column; gap:10px; align-items:flex-end; }
  .pct3-btn { padding:14px 28px; background:#0F1F5C; color:#FEE500; border:none; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:8px; transition:all .25s; box-shadow:0 8px 20px rgba(15,31,92,.25); white-space:nowrap; }
  .pct3-btn:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(15,31,92,.4); }
  .pct3-btn .icon { font-size:18px; }
  .pct3-id { font-size:11px; color:#3A2A00; font-weight:800; opacity:.7; }
  @media (max-width:640px) { .pct3-card { grid-template-columns:1fr; padding:28px 24px; } .pct3-content h2 { font-size:20px; } .pct3-cta { align-items:stretch; } }
  </style>
  <section class="pct3">
    <div class="pct3-inner">
      <div class="pct3-card">
        <div class="pct3-content">
          <span class="label">💬 KAKAO TALK</span>
          <h2>카카오톡으로<br/>지금 바로 상담받으세요</h2>
          <p>전화·이메일이 어려우시면 카카오톡 채널로 편하게 문의주세요. 평일 09-18시 실시간 응답.</p>
          <div class="stats">
            <div class="stat">평균 응답 <b>3분 이내</b></div>
            <div class="stat">누적 채널 친구 <b>4,800+</b></div>
          </div>
        </div>
        <div class="pct3-cta">
          <a class="pct3-btn" href="https://pf.kakao.com/_pourstore"><span class="icon">💬</span>채널 추가하고 상담</a>
          <div class="pct3-id">@POUR스토어</div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_CT_FAQ_HTML = `<style>
  .pct4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pct4 { background:#fff; padding:80px 18px; }
  .pct4-inner { max-width:880px; margin:0 auto; }
  .pct4-head { text-align:center; margin-bottom:32px; }
  .pct4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pct4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pct4-list { display:flex; flex-direction:column; gap:12px; }
  .pct4-item { background:#fff; border:1px solid #F3F4F6; border-radius:14px; overflow:hidden; transition:all .2s; }
  .pct4-item:hover { border-color:#FED7AA; }
  .pct4-item.open { border-color:#F97316; box-shadow:0 8px 24px rgba(249,115,22,.1); }
  .pct4-q { display:flex; align-items:center; gap:14px; padding:18px 22px; cursor:pointer; }
  .pct4-q .num { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-family:'Bebas Neue',sans-serif; font-size:14px; font-weight:900; color:#EA580C; flex-shrink:0; letter-spacing:.5px; }
  .pct4-q .text { flex:1; font-size:14.5px; font-weight:800; color:#0F1F5C; letter-spacing:-.3px; }
  .pct4-q .arrow { color:#9CA3AF; font-size:14px; transition:transform .2s; }
  .pct4-item.open .pct4-q .arrow { transform:rotate(180deg); color:#EA580C; }
  .pct4-a { padding:0 22px 20px 68px; font-size:13.5px; color:#4B5563; line-height:1.75; display:none; }
  .pct4-item.open .pct4-a { display:block; }
  .pct4-a b { color:#0F1F5C; font-weight:800; }
  @media (max-width:640px) { .pct4-head h2 { font-size:24px; } .pct4-a { padding-left:22px; } }
  </style>
  <section class="pct4">
    <div class="pct4-inner">
      <div class="pct4-head">
        <div class="kicker">FAQ</div>
        <h2>자주 묻는 질문</h2>
      </div>
      <div class="pct4-list">
        <div class="pct4-item open">
          <div class="pct4-q"><div class="num">Q1</div><div class="text">제품만 구매해서 셀프 시공이 가능한가요?</div><div class="arrow">▼</div></div>
          <div class="pct4-a">네, 가능합니다. POUR스토어는 <b>일반 사용자도 시공 가능한 제품 + 영상 가이드</b>를 제공합니다. 다만 고층 옥상·지하 등 위험 부위는 <b>전문 시공 매칭</b>을 권장합니다.</div>
        </div>
        <div class="pct4-item">
          <div class="pct4-q"><div class="num">Q2</div><div class="text">시공 견적은 어떻게 받을 수 있나요?</div><div class="arrow">▼</div></div>
          <div class="pct4-a">사이트 상단 <b>시공 연결 신청</b> 또는 본 페이지 폼에서 신청하시면, 가까운 파트너사가 <b>현장 방문 무료 진단</b> 후 견적서를 제공합니다. 일반적으로 신청 후 2-3일 내 연락드립니다.</div>
        </div>
        <div class="pct4-item">
          <div class="pct4-q"><div class="num">Q3</div><div class="text">전국 어디든 시공이 가능한가요?</div><div class="arrow">▼</div></div>
          <div class="pct4-a">네. <b>전국 250+ 전문 파트너사 네트워크</b>를 통해 17개 광역시·도 모두 시공 가능합니다. 도서산간 지역도 별도 협의로 진행됩니다.</div>
        </div>
        <div class="pct4-item">
          <div class="pct4-q"><div class="num">Q4</div><div class="text">시공 후 하자 보증은 얼마나 되나요?</div><div class="arrow">▼</div></div>
          <div class="pct4-a">공법별로 다르지만 일반적으로 <b>방수 5-10년 / 도장 3-7년</b> 보증을 시방서 기준으로 제공합니다. 정확한 기간은 시방서·계약서를 통해 명시됩니다.</div>
        </div>
        <div class="pct4-item">
          <div class="pct4-q"><div class="num">Q5</div><div class="text">파트너사·대리점 신청은 어디서 하나요?</div><div class="arrow">▼</div></div>
          <div class="pct4-a">상단 메뉴의 <b>파트너사 소개·신청</b> 또는 <b>대리점·공급 문의</b> 페이지에서 신청서를 작성해 주세요. 검토 후 영업일 기준 5-7일 내 회신드립니다.</div>
        </div>
        <div class="pct4-item">
          <div class="pct4-q"><div class="num">Q6</div><div class="text">대량 구매·B2B 단가 협의가 가능한가요?</div><div class="arrow">▼</div></div>
          <div class="pct4-a">네, 가능합니다. <b>관리사무소·시공사·관공서 발주</b>의 경우 별도 단가표를 제공합니다. 본 페이지 문의 폼에서 <b>제품 문의</b> 선택 후 신청해 주세요.</div>
        </div>
      </div>
    </div>
  </section>`;


  const SEED_PT_HERO_HTML = `<style>
  .ppt1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppt1 { background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 100%); padding:88px 18px 64px; position:relative; overflow:hidden; }
  .ppt1::before { content:''; position:absolute; top:-100px; right:-80px; width:420px; height:420px; background:radial-gradient(circle, rgba(249,115,22,.14) 0%, transparent 60%); border-radius:50%; }
  .ppt1::after { content:''; position:absolute; bottom:-60px; left:-60px; width:260px; height:260px; background:radial-gradient(circle, rgba(15,31,92,.06) 0%, transparent 60%); border-radius:50%; }
  .ppt1-inner { max-width:1100px; margin:0 auto; text-align:center; position:relative; z-index:1; }
  .ppt1-tag { display:inline-flex; gap:6px; padding:6px 14px; background:#fff; border:1px solid #FED7AA; color:#EA580C; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:20px; box-shadow:0 4px 12px rgba(249,115,22,.1); }
  .ppt1 h1 { font-size:46px; font-weight:900; color:#0F1F5C; line-height:1.2; margin-bottom:18px; letter-spacing:-1.4px; }
  .ppt1 h1 .accent { color:#F97316; }
  .ppt1-desc { font-size:16px; color:#4B5563; line-height:1.75; max-width:640px; margin:0 auto 32px; }
  .ppt1-cta { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-bottom:36px; }
  .ppt1-cta .primary { padding:14px 28px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer; text-decoration:none; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; display:inline-flex; align-items:center; gap:6px; }
  .ppt1-cta .primary:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  .ppt1-cta .ghost { padding:14px 24px; background:#fff; color:#0F1F5C; border:1px solid #E5E7EB; border-radius:14px; font-size:14px; font-weight:800; text-decoration:none; transition:all .25s; }
  .ppt1-cta .ghost:hover { border-color:#FED7AA; color:#EA580C; }
  .ppt1-stats { display:flex; gap:24px; justify-content:center; flex-wrap:wrap; padding-top:16px; }
  .ppt1-stat { text-align:center; }
  .ppt1-stat .v { font-family:'Bebas Neue',sans-serif; font-size:32px; font-weight:900; color:#F97316; line-height:1; letter-spacing:.5px; }
  .ppt1-stat .l { font-size:11.5px; color:#6B7280; margin-top:4px; font-weight:700; }
  @media (max-width:640px) { .ppt1 h1 { font-size:30px; } }
  </style>
  <section class="ppt1">
    <div class="ppt1-inner">
      <span class="ppt1-tag">🤝 PARTNER WITH POUR</span>
      <h1>POUR스토어와 함께하는<br/><span class="accent">파트너 시공사 모집</span></h1>
      <p class="ppt1-desc">전국 250+ 파트너사 네트워크에 합류하세요. 검증된 자재 · 안정적 일감 · R&D 기술 지원으로 함께 성장합니다.</p>
      <div class="ppt1-cta">
        <a class="primary" href="#apply-form">파트너 신청하기 →</a>
        <a class="ghost" href="#benefits">혜택 자세히 보기</a>
      </div>
      <div class="ppt1-stats">
        <div class="ppt1-stat"><div class="v">250+</div><div class="l">전국 파트너사</div></div>
        <div class="ppt1-stat"><div class="v">12,000+</div><div class="l">연간 시공 건수</div></div>
        <div class="ppt1-stat"><div class="v">94%</div><div class="l">재계약 비율</div></div>
        <div class="ppt1-stat"><div class="v">17</div><div class="l">광역시·도 커버리지</div></div>
      </div>
    </div>
  </section>`;

  const SEED_PT_BENEFIT_HTML = `<style>
  .ppt2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppt2 { background:#fff; padding:80px 18px; }
  .ppt2-inner { max-width:1200px; margin:0 auto; }
  .ppt2-head { text-align:center; margin-bottom:36px; }
  .ppt2-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppt2-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .ppt2-head p { font-size:14px; color:#6B7280; }
  .ppt2-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; }
  .ppt2-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:28px 24px; transition:all .25s; }
  .ppt2-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.1); border-color:#FED7AA; }
  .ppt2-card .icon { width:54px; height:54px; border-radius:14px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:26px; margin-bottom:16px; }
  .ppt2-card .name { font-size:16px; font-weight:900; color:#0F1F5C; margin-bottom:8px; letter-spacing:-.3px; }
  .ppt2-card .desc { font-size:13px; color:#6B7280; line-height:1.7; margin-bottom:14px; }
  .ppt2-card .point { display:inline-block; padding:4px 10px; background:#FFFBF5; border:1px solid #FED7AA; color:#EA580C; font-size:11px; font-weight:800; border-radius:6px; }
  @media (max-width:640px) { .ppt2-head h2 { font-size:24px; } }
  </style>
  <section class="ppt2" id="benefits">
    <div class="ppt2-inner">
      <div class="ppt2-head">
        <div class="kicker">PARTNER BENEFITS</div>
        <h2>POUR 파트너만의 혜택</h2>
        <p>단순 자재 공급사가 아닌 — 함께 성장하는 기술 파트너입니다</p>
      </div>
      <div class="ppt2-grid">
        <div class="ppt2-card"><div class="icon">📦</div><div class="name">자재 직공급</div><div class="desc">중간 유통 없이 본사 직공급 — 시중가 대비 평균 22% 절감</div><span class="point">최대 30% 할인</span></div>
        <div class="ppt2-card"><div class="icon">🎯</div><div class="name">안정적 일감 배정</div><div class="desc">시공 매칭 시스템으로 지역·전문분야에 맞는 일감 정기 배정</div><span class="point">월 평균 3.2건</span></div>
        <div class="ppt2-card"><div class="icon">🎓</div><div class="name">기술 교육·자격증</div><div class="desc">신공법·신제품 출시 시 무료 교육 + POUR 시공 자격증 발급</div><span class="point">연 4회 정기 교육</span></div>
        <div class="ppt2-card"><div class="icon">💼</div><div class="name">마케팅 지원</div><div class="desc">파트너사 페이지 노출 + 시공 사례 자동 등록 + SNS 광고 지원</div><span class="point">월 광고비 100만원</span></div>
        <div class="ppt2-card"><div class="icon">🛡️</div><div class="name">하자 책임 분담</div><div class="desc">자재 결함 하자는 본사가 100% 책임 — 시공자 부담 ZERO</div><span class="point">자재 보증 5-10년</span></div>
        <div class="ppt2-card"><div class="icon">💰</div><div class="name">결제 안전망</div><div class="desc">대규모 발주처 일감도 본사 선결제 — 미수금 리스크 없이 시공만 집중</div><span class="point">7일 내 정산</span></div>
      </div>
    </div>
  </section>`;

  const SEED_PT_REQ_HTML = `<style>
  .ppt3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppt3 { background:#FFFBF5; padding:80px 18px; }
  .ppt3-inner { max-width:980px; margin:0 auto; }
  .ppt3-head { text-align:center; margin-bottom:32px; }
  .ppt3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppt3-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .ppt3-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .ppt3-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:28px 26px; }
  .ppt3-card.must { border-left:4px solid #F97316; }
  .ppt3-card.plus { border-left:4px solid #059669; }
  .ppt3-card .label { display:inline-block; padding:4px 10px; background:#FFFBF5; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:800; border-radius:6px; margin-bottom:14px; letter-spacing:.5px; }
  .ppt3-card.plus .label { background:#ECFDF5; border-color:#A7F3D0; color:#059669; }
  .ppt3-card h3 { font-size:18px; font-weight:900; color:#0F1F5C; margin-bottom:18px; letter-spacing:-.3px; }
  .ppt3-list { display:flex; flex-direction:column; gap:12px; }
  .ppt3-item { display:flex; gap:12px; padding:12px; background:#FFFBF5; border-radius:10px; }
  .ppt3-card.plus .ppt3-item { background:#ECFDF5; }
  .ppt3-item .check { width:22px; height:22px; border-radius:50%; background:#F97316; color:#fff; font-size:13px; font-weight:900; display:grid; place-items:center; flex-shrink:0; }
  .ppt3-card.plus .ppt3-item .check { background:#059669; }
  .ppt3-item .text { flex:1; }
  .ppt3-item .text .ttl { font-size:13px; font-weight:800; color:#0F1F5C; margin-bottom:3px; letter-spacing:-.3px; }
  .ppt3-item .text .desc { font-size:12px; color:#6B7280; line-height:1.55; }
  @media (max-width:720px) { .ppt3-grid { grid-template-columns:1fr; } .ppt3-head h2 { font-size:24px; } }
  </style>
  <section class="ppt3">
    <div class="ppt3-inner">
      <div class="ppt3-head">
        <div class="kicker">REQUIREMENTS</div>
        <h2>파트너 자격 요건</h2>
      </div>
      <div class="ppt3-grid">
        <div class="ppt3-card must">
          <span class="label">✓ 필수 요건</span>
          <h3>최소 자격</h3>
          <div class="ppt3-list">
            <div class="ppt3-item"><div class="check">✓</div><div class="text"><div class="ttl">사업자등록증</div><div class="desc">건설·인테리어·도장·방수 관련 업태</div></div></div>
            <div class="ppt3-item"><div class="check">✓</div><div class="text"><div class="ttl">시공 경력 3년 이상</div><div class="desc">방수·도장·균열보수 중 1개 이상 분야</div></div></div>
            <div class="ppt3-item"><div class="check">✓</div><div class="text"><div class="ttl">시공 사례 5건 이상</div><div class="desc">최근 3년 내 시공 사진·도면 제출</div></div></div>
            <div class="ppt3-item"><div class="check">✓</div><div class="text"><div class="ttl">산재보험 가입</div><div class="desc">근로자 안전 보장 필수</div></div></div>
          </div>
        </div>
        <div class="ppt3-card plus">
          <span class="label">+ 우대 사항</span>
          <h3>가점 요건</h3>
          <div class="ppt3-list">
            <div class="ppt3-item"><div class="check">+</div><div class="text"><div class="ttl">기술자격증 보유</div><div class="desc">건축·도장·방수 기능사·산업기사·기사</div></div></div>
            <div class="ppt3-item"><div class="check">+</div><div class="text"><div class="ttl">전문건설업 면허</div><div class="desc">미장·방수·습식 면허 보유 시 우대</div></div></div>
            <div class="ppt3-item"><div class="check">+</div><div class="text"><div class="ttl">관공서·공동주택 실적</div><div class="desc">아파트·관공서 시공 경험 보유</div></div></div>
            <div class="ppt3-item"><div class="check">+</div><div class="text"><div class="ttl">친환경·안전 인증</div><div class="desc">ISO 등 품질·환경 시스템 인증</div></div></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_PT_FLOW_HTML = `<style>
  .ppt4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppt4 { background:#fff; padding:80px 18px; }
  .ppt4-inner { max-width:1100px; margin:0 auto; }
  .ppt4-head { text-align:center; margin-bottom:40px; }
  .ppt4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppt4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .ppt4-head p { font-size:14px; color:#6B7280; }
  .ppt4-flow { display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; position:relative; }
  .ppt4-flow::before { content:''; position:absolute; top:38px; left:10%; right:10%; height:2px; background:linear-gradient(90deg, #FED7AA, #F97316, #FED7AA); z-index:0; }
  .ppt4-step { position:relative; z-index:1; text-align:center; }
  .ppt4-step .num { width:76px; height:76px; margin:0 auto 14px; border-radius:50%; background:#fff; border:3px solid #F97316; display:grid; place-items:center; font-family:'Bebas Neue',sans-serif; font-size:24px; font-weight:900; color:#F97316; box-shadow:0 8px 20px rgba(249,115,22,.15); letter-spacing:.5px; }
  .ppt4-step .name { font-size:14px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .ppt4-step .desc { font-size:11.5px; color:#6B7280; line-height:1.55; }
  .ppt4-step .duration { display:inline-block; margin-top:8px; padding:3px 8px; background:#FFFBF5; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:800; border-radius:5px; }
  @media (max-width:880px) { .ppt4-flow { grid-template-columns:1fr; gap:24px; } .ppt4-flow::before { display:none; } .ppt4-head h2 { font-size:24px; } }
  </style>
  <section class="ppt4">
    <div class="ppt4-inner">
      <div class="ppt4-head">
        <div class="kicker">PROCESS</div>
        <h2>파트너 신청 진행 절차</h2>
        <p>신청부터 계약까지 평균 영업일 기준 14일</p>
      </div>
      <div class="ppt4-flow">
        <div class="ppt4-step"><div class="num">01</div><div class="name">신청서 제출</div><div class="desc">온라인 폼 작성<br/>+ 사업자등록증</div><div class="duration">즉시</div></div>
        <div class="ppt4-step"><div class="num">02</div><div class="name">서류 검토</div><div class="desc">실적·경력 확인<br/>+ 결격 사유 검증</div><div class="duration">3-5일</div></div>
        <div class="ppt4-step"><div class="num">03</div><div class="name">실사 방문</div><div class="desc">사무실·창고 실사<br/>+ 대표 면담</div><div class="duration">5-7일</div></div>
        <div class="ppt4-step"><div class="num">04</div><div class="name">계약 체결</div><div class="desc">파트너 계약서<br/>+ 등급 확정 (A/B/C)</div><div class="duration">7-10일</div></div>
        <div class="ppt4-step"><div class="num">05</div><div class="name">시공 시작</div><div class="desc">교육 이수 후<br/>+ 첫 일감 배정</div><div class="duration">10-14일</div></div>
      </div>
    </div>
  </section>`;

  const SEED_PT_LOGOS_HTML = `<style>
  .ppt5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppt5 { background:#FFFBF5; padding:64px 18px; }
  .ppt5-inner { max-width:1200px; margin:0 auto; }
  .ppt5-head { text-align:center; margin-bottom:32px; }
  .ppt5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppt5-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .ppt5-head p { font-size:13.5px; color:#6B7280; }
  .ppt5-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }
  .ppt5-logo { aspect-ratio:5/3; background:#fff; border:1px solid #F3F4F6; border-radius:14px; display:grid; place-items:center; padding:18px; transition:all .25s; }
  .ppt5-logo:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(15,31,92,.08); border-color:#FED7AA; }
  .ppt5-logo .name { font-size:13.5px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; text-align:center; line-height:1.4; }
  .ppt5-logo .name .sub { display:block; font-size:10.5px; color:#9CA3AF; font-weight:700; margin-top:2px; letter-spacing:.3px; }
  .ppt5-more { text-align:center; margin-top:24px; }
  .ppt5-more a { font-size:13px; font-weight:800; color:#EA580C; text-decoration:none; padding:10px 22px; border:1px solid #FED7AA; border-radius:999px; background:#fff; transition:all .25s; }
  .ppt5-more a:hover { background:#FFF7ED; }
  @media (max-width:640px) { .ppt5-head h2 { font-size:22px; } }
  </style>
  <section class="ppt5">
    <div class="ppt5-inner">
      <div class="ppt5-head">
        <div class="kicker">OUR PARTNERS</div>
        <h2>POUR와 함께하는 파트너사</h2>
        <p>전국 250+ 시공사 — 지역별 대표 파트너 일부 소개</p>
      </div>
      <div class="ppt5-grid">
        <div class="ppt5-logo"><div class="name">SH건설<span class="sub">서울 · 강남</span></div></div>
        <div class="ppt5-logo"><div class="name">한울방수<span class="sub">경기 · 수원</span></div></div>
        <div class="ppt5-logo"><div class="name">대성도장<span class="sub">인천 · 송도</span></div></div>
        <div class="ppt5-logo"><div class="name">부산테크<span class="sub">부산 · 해운대</span></div></div>
        <div class="ppt5-logo"><div class="name">남광시공<span class="sub">대구 · 수성</span></div></div>
        <div class="ppt5-logo"><div class="name">광주리노<span class="sub">광주 · 서구</span></div></div>
        <div class="ppt5-logo"><div class="name">대전건축<span class="sub">대전 · 유성</span></div></div>
        <div class="ppt5-logo"><div class="name">울산E&C<span class="sub">울산 · 남구</span></div></div>
        <div class="ppt5-logo"><div class="name">강원종합<span class="sub">강원 · 춘천</span></div></div>
        <div class="ppt5-logo"><div class="name">충청기술<span class="sub">충북 · 청주</span></div></div>
        <div class="ppt5-logo"><div class="name">호남파트너<span class="sub">전남 · 여수</span></div></div>
        <div class="ppt5-logo"><div class="name">제주방수<span class="sub">제주 · 제주시</span></div></div>
      </div>
      <div class="ppt5-more"><a href="#">전체 250+ 파트너사 보기 →</a></div>
    </div>
  </section>`;

  const SEED_PT_FORM_HTML = `<style>
  .ppt6 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppt6 { background:#fff; padding:80px 18px; }
  .ppt6-inner { max-width:980px; margin:0 auto; }
  .ppt6-head { text-align:center; margin-bottom:32px; }
  .ppt6-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppt6-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .ppt6-head p { font-size:14px; color:#6B7280; }
  .ppt6-card { background:#fff; border:1px solid #F3F4F6; border-radius:24px; padding:36px 32px; box-shadow:0 12px 36px rgba(15,31,92,.06); }
  .ppt6-section { margin-bottom:24px; }
  .ppt6-section .stitle { font-size:13px; font-weight:900; color:#0F1F5C; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid #FFEDD5; letter-spacing:-.3px; }
  .ppt6-row { margin-bottom:14px; }
  .ppt6-row.split { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .ppt6-row label { display:block; font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .ppt6-row input, .ppt6-row select, .ppt6-row textarea { width:100%; padding:12px 14px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:10px; font-size:14px; font-family:inherit; color:#0F1F5C; transition:all .2s; }
  .ppt6-row textarea { min-height:96px; resize:vertical; }
  .ppt6-row input:focus, .ppt6-row select:focus, .ppt6-row textarea:focus { outline:none; border-color:#FED7AA; background:#fff; box-shadow:0 0 0 3px rgba(249,115,22,.08); }
  .ppt6-checks { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px; }
  .ppt6-check { padding:10px 14px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:10px; font-size:12.5px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; text-align:center; }
  .ppt6-check:hover { border-color:#FED7AA; }
  .ppt6-check.active { background:#FFF7ED; border-color:#F97316; color:#EA580C; font-weight:800; }
  .ppt6-upload { padding:20px; background:#FFFBF5; border:2px dashed #FED7AA; border-radius:12px; text-align:center; }
  .ppt6-upload .icon { font-size:24px; margin-bottom:6px; }
  .ppt6-upload .text { font-size:13px; color:#6B7280; font-weight:700; }
  .ppt6-upload .hint { font-size:11px; color:#9CA3AF; margin-top:4px; }
  .ppt6-agree { display:flex; align-items:center; gap:8px; margin-bottom:18px; padding:14px; background:#FFFBF5; border-radius:10px; font-size:12.5px; color:#4B5563; }
  .ppt6-agree input { width:16px; height:16px; accent-color:#F97316; }
  .ppt6-submit { width:100%; padding:16px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; }
  .ppt6-submit:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  @media (max-width:640px) { .ppt6-card { padding:24px 18px; } .ppt6-row.split { grid-template-columns:1fr; } .ppt6-head h2 { font-size:24px; } }
  </style>
  <section class="ppt6" id="apply-form">
    <div class="ppt6-inner">
      <div class="ppt6-head">
        <div class="kicker">APPLICATION</div>
        <h2>파트너사 신청서</h2>
        <p>아래 정보를 입력해 주시면 검토 후 영업일 기준 5-7일 내 연락드립니다</p>
      </div>
      <form class="ppt6-card" id="ppt6-form" onsubmit="return false;">
        <div class="ppt6-section">
          <div class="stitle">📋 회사 정보</div>
          <div class="ppt6-row split">
            <div><label>회사명 *</label><input type="text" id="ppt6-company" placeholder="㈜한울방수"/></div>
            <div><label>사업자등록번호</label><input type="text" id="ppt6-bn" placeholder="000-00-00000"/></div>
          </div>
          <div class="ppt6-row split">
            <div><label>대표자명</label><input type="text" id="ppt6-ceo" placeholder="홍길동"/></div>
            <div><label>설립연도</label><input type="text" id="ppt6-year" placeholder="2015"/></div>
          </div>
          <div class="ppt6-row"><label>사업장 주소</label><input type="text" id="ppt6-addr" placeholder="경기도 ○○시 ○○로 ○○"/></div>
        </div>
        <div class="ppt6-section">
          <div class="stitle">👤 담당자 정보</div>
          <div class="ppt6-row split">
            <div><label>담당자명 *</label><input type="text" id="ppt6-name" placeholder="홍길동"/></div>
            <div><label>연락처 *</label><input type="text" id="ppt6-phone" placeholder="010-0000-0000"/></div>
          </div>
          <div class="ppt6-row"><label>이메일</label><input type="email" id="ppt6-email" placeholder="example@email.com"/></div>
        </div>
        <div class="ppt6-section">
          <div class="stitle">🔧 시공 가능 분야 (복수 선택)</div>
          <div class="ppt6-checks" id="ppt6-fields">
            <div class="ppt6-check active" data-v="방수">방수</div>
            <div class="ppt6-check active" data-v="도장">도장</div>
            <div class="ppt6-check" data-v="균열 보수">균열 보수</div>
            <div class="ppt6-check" data-v="코팅·단열">코팅·단열</div>
            <div class="ppt6-check" data-v="에폭시·바닥">에폭시·바닥</div>
            <div class="ppt6-check" data-v="아스콘·토목">아스콘·토목</div>
            <div class="ppt6-check" data-v="기타">기타</div>
          </div>
        </div>
        <div class="ppt6-section">
          <div class="stitle">📊 시공 실적</div>
          <div class="ppt6-row split">
            <div><label>시공 경력</label><select id="ppt6-career"><option>3년 미만</option><option>3-5년</option><option>5-10년</option><option>10년 이상</option></select></div>
            <div><label>연 시공 건수</label><select id="ppt6-volume"><option>10건 미만</option><option>10-30건</option><option>30-100건</option><option>100건 이상</option></select></div>
          </div>
          <div class="ppt6-row"><label>주요 실적 (간단 기재)</label><textarea id="ppt6-record" placeholder="최근 3년 주요 시공 단지·관공서·발주처 등"></textarea></div>
        </div>
        <div class="ppt6-section">
          <div class="stitle">📎 첨부 서류 (제출 후 별도 안내)</div>
          <div class="ppt6-upload"><div class="icon">📎</div><div class="text">사업자등록증 · 시공 실적표 · 면허증 등</div><div class="hint">신청 접수 후 담당자가 이메일로 안내</div></div>
        </div>
        <div class="ppt6-agree"><input type="checkbox" id="ag2"/><label for="ag2">개인정보·기업정보 수집·이용에 동의합니다</label></div>
        <div id="ppt6-msg" style="display:none;margin-bottom:10px;padding:12px 14px;border-radius:9px;font-size:13px;font-weight:700;"></div>
        <button type="button" id="ppt6-submit-btn" class="ppt6-submit">파트너 신청하기</button>
      </form>
    </div>
  </section>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script>
(function(){
  if (!window.firebase) { console.warn('[ppt6] Firebase SDK 로드 실패'); return; }
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU',
      authDomain: 'pour-app-new.firebaseapp.com',
      projectId: 'pour-app-new',
      storageBucket: 'pour-app-new.firebasestorage.app',
      messagingSenderId: '411031141847',
      appId: '1:411031141847:web:e658174fd4b9652cdadf92'
    });
  }
  var db = firebase.firestore();
  var root = document.querySelector('.ppt6');
  if (!root) return;

  // 시공 분야 칩 복수 토글
  root.querySelectorAll('#ppt6-fields .ppt6-check').forEach(function(b){
    b.addEventListener('click', function(){ b.classList.toggle('active'); });
  });

  function showMsg(text, type){
    var el = root.querySelector('#ppt6-msg');
    el.textContent = text;
    el.style.display = 'block';
    if (type === 'success') { el.style.background = '#ECFDF5'; el.style.border = '1px solid #A7F3D0'; el.style.color = '#047857'; }
    else { el.style.background = '#FEE2E2'; el.style.border = '1px solid #FCA5A5'; el.style.color = '#DC2626'; }
  }

  root.querySelector('#ppt6-submit-btn').addEventListener('click', async function(){
    var company = root.querySelector('#ppt6-company').value.trim();
    var name = root.querySelector('#ppt6-name').value.trim();
    var phone = root.querySelector('#ppt6-phone').value.trim();
    var agree = root.querySelector('#ag2').checked;
    if (!company || !name || !phone) { showMsg('회사명, 담당자명, 연락처는 필수입니다', 'error'); return; }
    if (!agree) { showMsg('개인정보·기업정보 수집·이용 동의가 필요합니다', 'error'); return; }

    var fields = Array.from(root.querySelectorAll('#ppt6-fields .ppt6-check.active')).map(function(b){return b.dataset.v;});
    var data = {
      type: '파트너사 신청',
      brand: 'pourstore',
      companyName: company,
      businessNumber: root.querySelector('#ppt6-bn').value.trim(),
      representative: root.querySelector('#ppt6-ceo').value.trim(),
      foundedYear: root.querySelector('#ppt6-year').value.trim(),
      address: root.querySelector('#ppt6-addr').value.trim(),
      contactName: name,
      contactPhone: phone,
      contactEmail: root.querySelector('#ppt6-email').value.trim(),
      specialities: fields,
      experience: root.querySelector('#ppt6-career').value || '',
      volume: root.querySelector('#ppt6-volume').value || '',
      record: root.querySelector('#ppt6-record').value.trim(),
      status: '신규',
      source: 'pourstore-site',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    var btn = root.querySelector('#ppt6-submit-btn');
    btn.disabled = true; btn.textContent = '신청 중...';
    try {
      await db.collection('partner-inquiries').add(data);
      showMsg('✅ 파트너 신청이 접수되었습니다. 영업일 기준 5-7일 내 검토 후 연락드립니다.', 'success');
      btn.textContent = '✓ 신청 완료';
      setTimeout(function(){ root.querySelector('#ppt6-form').reset(); btn.disabled = false; btn.textContent = '파트너 신청하기'; root.querySelector('#ppt6-msg').style.display = 'none'; }, 5000);
    } catch (e) {
      console.error('[ppt6]', e);
      showMsg('❌ 신청 실패: ' + e.message + ' — 잠시 후 다시 시도해 주세요', 'error');
      btn.disabled = false; btn.textContent = '파트너 신청하기';
    }
  });
})();
</script>`;

  const SEED_PT_FAQ_HTML = `<style>
  .ppt7 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppt7 { background:#FFFBF5; padding:80px 18px; }
  .ppt7-inner { max-width:880px; margin:0 auto; }
  .ppt7-head { text-align:center; margin-bottom:32px; }
  .ppt7-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppt7-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .ppt7-list { display:flex; flex-direction:column; gap:12px; }
  .ppt7-item { background:#fff; border:1px solid #F3F4F6; border-radius:14px; overflow:hidden; transition:all .2s; }
  .ppt7-item:hover { border-color:#FED7AA; }
  .ppt7-item.open { border-color:#F97316; box-shadow:0 8px 24px rgba(249,115,22,.1); }
  .ppt7-q { display:flex; align-items:center; gap:14px; padding:18px 22px; cursor:pointer; }
  .ppt7-q .num { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-family:'Bebas Neue',sans-serif; font-size:14px; font-weight:900; color:#EA580C; flex-shrink:0; }
  .ppt7-q .text { flex:1; font-size:14.5px; font-weight:800; color:#0F1F5C; letter-spacing:-.3px; }
  .ppt7-q .arrow { color:#9CA3AF; font-size:14px; transition:transform .2s; }
  .ppt7-item.open .ppt7-q .arrow { transform:rotate(180deg); color:#EA580C; }
  .ppt7-a { padding:0 22px 20px 68px; font-size:13.5px; color:#4B5563; line-height:1.75; display:none; }
  .ppt7-item.open .ppt7-a { display:block; }
  .ppt7-a b { color:#0F1F5C; font-weight:800; }
  @media (max-width:640px) { .ppt7-head h2 { font-size:24px; } .ppt7-a { padding-left:22px; } }
  </style>
  <section class="ppt7">
    <div class="ppt7-inner">
      <div class="ppt7-head">
        <div class="kicker">FAQ</div>
        <h2>파트너 신청 자주 묻는 질문</h2>
      </div>
      <div class="ppt7-list">
        <div class="ppt7-item open">
          <div class="ppt7-q"><div class="num">Q1</div><div class="text">계약금이나 가입비가 있나요?</div><div class="arrow">▼</div></div>
          <div class="ppt7-a">아니요. <b>가입비·계약금·보증금 없음</b>. 자재 구매가만 본사 직공급가로 정산되며, 시공 일감은 본사가 무상 배정합니다.</div>
        </div>
        <div class="ppt7-item">
          <div class="ppt7-q"><div class="num">Q2</div><div class="text">파트너 등급(A/B/C)은 어떻게 정해지나요?</div><div class="arrow">▼</div></div>
          <div class="ppt7-a">시공 경력·면허·실적·고객 만족도를 종합 평가하여 <b>A/B/C 3등급</b>으로 분류됩니다. 등급별로 일감 우선순위·할인율·교육 혜택이 차등 적용되며, 매년 1회 재평가합니다.</div>
        </div>
        <div class="ppt7-item">
          <div class="ppt7-q"><div class="num">Q3</div><div class="text">전속 계약인가요? 다른 자재사도 사용 가능한가요?</div><div class="arrow">▼</div></div>
          <div class="ppt7-a">전속 계약이 아닙니다. <b>POUR 자재는 POUR 일감에만 의무 적용</b>되며, 다른 발주처 일감에서는 자유롭게 다른 자재를 사용 가능합니다.</div>
        </div>
        <div class="ppt7-item">
          <div class="ppt7-q"><div class="num">Q4</div><div class="text">월 일감은 얼마나 배정되나요?</div><div class="arrow">▼</div></div>
          <div class="ppt7-a">지역·등급·전문분야에 따라 다르지만 <b>평균 월 3.2건</b>이 배정됩니다. 성수기(3-10월)에는 더 많이, 비수기(11-2월)에는 다소 적게 배정될 수 있습니다.</div>
        </div>
        <div class="ppt7-item">
          <div class="ppt7-q"><div class="num">Q5</div><div class="text">시공 후 정산은 언제 받나요?</div><div class="arrow">▼</div></div>
          <div class="ppt7-a"><b>시공 완료 검수 후 7일 내 정산</b>됩니다. 발주처 결제와 무관하게 본사가 선결제하므로 미수금 리스크가 없습니다.</div>
        </div>
        <div class="ppt7-item">
          <div class="ppt7-q"><div class="num">Q6</div><div class="text">교육은 의무인가요? 비용은요?</div><div class="arrow">▼</div></div>
          <div class="ppt7-a">신규 가입 후 <b>POUR 시공 자격 교육(1일)</b> 이수가 의무이며, <b>전액 무료</b>입니다. 이후 신공법·신제품 출시 시 정기 교육은 선택 참여이며 모두 무료입니다.</div>
        </div>
      </div>
    </div>
  </section>`;


  const SEED_DL_HERO_HTML = `<style>
  .pdl1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pdl1 { background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 100%); padding:88px 18px 64px; position:relative; overflow:hidden; }
  .pdl1::before { content:''; position:absolute; top:-100px; right:-100px; width:440px; height:440px; background:radial-gradient(circle, rgba(249,115,22,.14) 0%, transparent 60%); border-radius:50%; }
  .pdl1-inner { max-width:1100px; margin:0 auto; text-align:center; position:relative; z-index:1; }
  .pdl1-tag { display:inline-flex; gap:6px; padding:6px 14px; background:#fff; border:1px solid #FED7AA; color:#EA580C; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:20px; box-shadow:0 4px 12px rgba(249,115,22,.1); }
  .pdl1 h1 { font-size:46px; font-weight:900; color:#0F1F5C; line-height:1.2; margin-bottom:18px; letter-spacing:-1.4px; }
  .pdl1 h1 .accent { color:#F97316; }
  .pdl1-desc { font-size:16px; color:#4B5563; line-height:1.75; max-width:640px; margin:0 auto 32px; }
  .pdl1-cta { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-bottom:36px; }
  .pdl1-cta .primary { padding:14px 28px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer; text-decoration:none; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; }
  .pdl1-cta .primary:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  .pdl1-cta .ghost { padding:14px 24px; background:#fff; color:#0F1F5C; border:1px solid #E5E7EB; border-radius:14px; font-size:14px; font-weight:800; text-decoration:none; }
  .pdl1-stats { display:flex; gap:24px; justify-content:center; flex-wrap:wrap; padding-top:16px; }
  .pdl1-stat { text-align:center; }
  .pdl1-stat .v { font-family:'Bebas Neue',sans-serif; font-size:32px; font-weight:900; color:#F97316; line-height:1; letter-spacing:.5px; }
  .pdl1-stat .l { font-size:11.5px; color:#6B7280; margin-top:4px; font-weight:700; }
  @media (max-width:640px) { .pdl1 h1 { font-size:30px; } }
  </style>
  <section class="pdl1">
    <div class="pdl1-inner">
      <span class="pdl1-tag">🏪 BECOME A DEALER</span>
      <h1>POUR스토어<br/><span class="accent">대리점·유통 파트너 모집</span></h1>
      <p class="pdl1-desc">검증된 R&D 자재를 지역 거점에서 유통하세요. 전국 17개 광역에 우수 대리점을 모집합니다 — 안정 마진·전속 영업권 보장.</p>
      <div class="pdl1-cta">
        <a class="primary" href="#dealer-form">대리점 신청 →</a>
        <a class="ghost" href="#margin">마진 구조 보기</a>
      </div>
      <div class="pdl1-stats">
        <div class="pdl1-stat"><div class="v">42</div><div class="l">전국 대리점</div></div>
        <div class="pdl1-stat"><div class="v">평균 28%</div><div class="l">유통 마진</div></div>
        <div class="pdl1-stat"><div class="v">98%</div><div class="l">재계약률</div></div>
        <div class="pdl1-stat"><div class="v">12개</div><div class="l">신규 모집 권역</div></div>
      </div>
    </div>
  </section>`;

  const SEED_DL_MARGIN_HTML = `<style>
  .pdl2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pdl2 { background:#fff; padding:80px 18px; }
  .pdl2-inner { max-width:1100px; margin:0 auto; }
  .pdl2-head { text-align:center; margin-bottom:36px; }
  .pdl2-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pdl2-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pdl2-head p { font-size:14px; color:#6B7280; }
  .pdl2-tiers { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:32px; }
  .pdl2-tier { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:28px 24px; transition:all .25s; }
  .pdl2-tier.gold { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border-color:#F97316; box-shadow:0 18px 40px rgba(249,115,22,.12); transform:scale(1.02); position:relative; }
  .pdl2-tier.gold::before { content:'⭐ 추천'; position:absolute; top:-12px; left:50%; transform:translateX(-50%); padding:5px 12px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; font-size:10.5px; font-weight:900; border-radius:6px; letter-spacing:.5px; }
  .pdl2-tier .name { font-size:13px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .pdl2-tier .pct { font-family:'Bebas Neue',sans-serif; font-size:48px; font-weight:900; color:#F97316; line-height:1; letter-spacing:.5px; margin-bottom:6px; }
  .pdl2-tier .pct .unit { font-family:'Noto Sans KR',sans-serif; font-size:18px; font-weight:800; color:#0F1F5C; }
  .pdl2-tier .desc { font-size:12px; color:#6B7280; margin-bottom:18px; line-height:1.6; }
  .pdl2-tier ul { list-style:none; padding:0; margin:0; }
  .pdl2-tier li { font-size:12.5px; color:#4B5563; padding:6px 0; padding-left:18px; position:relative; line-height:1.55; }
  .pdl2-tier li::before { content:'✓'; position:absolute; left:0; color:#F97316; font-weight:900; }
  .pdl2-note { padding:18px 22px; background:#FFFBF5; border:1px solid #FED7AA; border-radius:14px; }
  .pdl2-note .label { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .pdl2-note .text { font-size:13px; color:#4B5563; line-height:1.7; }
  .pdl2-note b { color:#0F1F5C; font-weight:800; }
  @media (max-width:880px) { .pdl2-tiers { grid-template-columns:1fr; } .pdl2-tier.gold { transform:none; } .pdl2-head h2 { font-size:24px; } }
  </style>
  <section class="pdl2" id="margin">
    <div class="pdl2-inner">
      <div class="pdl2-head">
        <div class="kicker">MARGIN STRUCTURE</div>
        <h2>대리점 마진 구조</h2>
        <p>월 매출 기준 자동 차등 — 키울수록 더 큰 마진을 가져갑니다</p>
      </div>
      <div class="pdl2-tiers">
        <div class="pdl2-tier"><div class="name">SILVER</div><div class="pct">22<span class="unit">%</span></div><div class="desc">월 매출 1천만원 이하 — 신규 대리점 진입 단계</div><ul><li>자재 본사 직공급가</li><li>판매보조금 월 50만원</li><li>제품 카탈로그 무상 제공</li><li>교육 무료 (분기 1회)</li></ul></div>
        <div class="pdl2-tier gold"><div class="name">GOLD</div><div class="pct">28<span class="unit">%</span></div><div class="desc">월 매출 1천-3천만원 — 가장 많은 대리점 구간</div><ul><li>실버 혜택 + 추가 마진 6%</li><li>판매보조금 월 100만원</li><li>전속 영업권 (지역 단독)</li><li>지역 광고 50% 분담</li><li>전시 샘플 무상 보충</li></ul></div>
        <div class="pdl2-tier"><div class="name">PLATINUM</div><div class="pct">35<span class="unit">%</span></div><div class="desc">월 매출 3천만원 이상 — 우수 대리점 대상</div><ul><li>골드 혜택 + 추가 마진 7%</li><li>판매보조금 월 200만원</li><li>지역 광고 100% 본사 부담</li><li>신제품 우선 공급</li><li>해외 연수 (연 1회)</li></ul></div>
      </div>
      <div class="pdl2-note">
        <div class="label">💡 추가 인센티브</div>
        <div class="text">월 매출 목표 달성 시 <b>추가 3% 보너스</b>, 신규 시공사 영입 시 <b>건당 30만원 인센티브</b>, 연간 우수 대리점 선정 시 <b>해외 연수·포상</b> 별도 제공.</div>
      </div>
    </div>
  </section>`;

  const SEED_DL_REQ_HTML = `<style>
  .pdl3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pdl3 { background:#FFFBF5; padding:80px 18px; }
  .pdl3-inner { max-width:980px; margin:0 auto; }
  .pdl3-head { text-align:center; margin-bottom:32px; }
  .pdl3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pdl3-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pdl3-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .pdl3-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:28px 26px; }
  .pdl3-card.must { border-left:4px solid #F97316; }
  .pdl3-card.plus { border-left:4px solid #059669; }
  .pdl3-card .label { display:inline-block; padding:4px 10px; background:#FFFBF5; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:800; border-radius:6px; margin-bottom:14px; letter-spacing:.5px; }
  .pdl3-card.plus .label { background:#ECFDF5; border-color:#A7F3D0; color:#059669; }
  .pdl3-card h3 { font-size:18px; font-weight:900; color:#0F1F5C; margin-bottom:18px; letter-spacing:-.3px; }
  .pdl3-list { display:flex; flex-direction:column; gap:12px; }
  .pdl3-item { display:flex; gap:12px; padding:12px; background:#FFFBF5; border-radius:10px; }
  .pdl3-card.plus .pdl3-item { background:#ECFDF5; }
  .pdl3-item .check { width:22px; height:22px; border-radius:50%; background:#F97316; color:#fff; font-size:13px; font-weight:900; display:grid; place-items:center; flex-shrink:0; }
  .pdl3-card.plus .pdl3-item .check { background:#059669; }
  .pdl3-item .text .ttl { font-size:13px; font-weight:800; color:#0F1F5C; margin-bottom:3px; }
  .pdl3-item .text .desc { font-size:12px; color:#6B7280; line-height:1.55; }
  @media (max-width:720px) { .pdl3-grid { grid-template-columns:1fr; } .pdl3-head h2 { font-size:24px; } }
  </style>
  <section class="pdl3">
    <div class="pdl3-inner">
      <div class="pdl3-head">
        <div class="kicker">REQUIREMENTS</div>
        <h2>대리점 자격 요건</h2>
      </div>
      <div class="pdl3-grid">
        <div class="pdl3-card must">
          <span class="label">✓ 필수 요건</span>
          <h3>최소 자격</h3>
          <div class="pdl3-list">
            <div class="pdl3-item"><div class="check">✓</div><div class="text"><div class="ttl">사업자등록증</div><div class="desc">건축자재·도소매·유통 관련 업태</div></div></div>
            <div class="pdl3-item"><div class="check">✓</div><div class="text"><div class="ttl">매장·창고 33㎡ 이상</div><div class="desc">샘플 진열 + 재고 보관 공간</div></div></div>
            <div class="pdl3-item"><div class="check">✓</div><div class="text"><div class="ttl">초기 재고 매입 (1천만원)</div><div class="desc">기본 SKU 셋업 — 판매 후 정산</div></div></div>
            <div class="pdl3-item"><div class="check">✓</div><div class="text"><div class="ttl">상시 직원 1인 이상</div><div class="desc">고객 응대·상품 안내 가능자</div></div></div>
          </div>
        </div>
        <div class="pdl3-card plus">
          <span class="label">+ 우대 사항</span>
          <h3>가점 요건</h3>
          <div class="pdl3-list">
            <div class="pdl3-item"><div class="check">+</div><div class="text"><div class="ttl">건설자재 유통 경력</div><div class="desc">방수·도장·페인트 도소매 5년 이상</div></div></div>
            <div class="pdl3-item"><div class="check">+</div><div class="text"><div class="ttl">지역 시공사 네트워크</div><div class="desc">해당 권역 시공사 거래처 보유</div></div></div>
            <div class="pdl3-item"><div class="check">+</div><div class="text"><div class="ttl">매장 가시성·접근성</div><div class="desc">대로변·산업단지 인근·주차 가능</div></div></div>
            <div class="pdl3-item"><div class="check">+</div><div class="text"><div class="ttl">자체 운반 차량 보유</div><div class="desc">현장 직배송 가능 시 가점</div></div></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_DL_CAT_HTML = `<style>
  .pdl4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pdl4 { background:#fff; padding:80px 18px; }
  .pdl4-inner { max-width:1200px; margin:0 auto; }
  .pdl4-head { text-align:center; margin-bottom:36px; }
  .pdl4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pdl4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .pdl4-head p { font-size:14px; color:#6B7280; }
  .pdl4-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
  .pdl4-card { background:#fff; border:1px solid #F3F4F6; border-radius:16px; padding:24px 22px; transition:all .25s; }
  .pdl4-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .pdl4-card .icon { width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:24px; margin-bottom:14px; }
  .pdl4-card .name { font-size:15.5px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .pdl4-card .count { font-size:11px; font-weight:800; color:#EA580C; margin-bottom:10px; }
  .pdl4-card .items { display:flex; flex-wrap:wrap; gap:5px; }
  .pdl4-card .item { padding:3px 9px; background:#FFFBF5; border:1px solid #F3F4F6; color:#4B5563; font-size:10.5px; font-weight:700; border-radius:5px; }
  @media (max-width:640px) { .pdl4-head h2 { font-size:24px; } }
  </style>
  <section class="pdl4">
    <div class="pdl4-inner">
      <div class="pdl4-head">
        <div class="kicker">SUPPLY CATEGORIES</div>
        <h2>공급 가능 카테고리</h2>
        <p>전 카테고리 110+ SKU — 대리점은 전 라인업 자유 취급 가능</p>
      </div>
      <div class="pdl4-grid">
        <div class="pdl4-card"><div class="icon">💧</div><div class="name">방수재</div><div class="count">28종</div><div class="items"><span class="item">코트재</span><span class="item">시트</span><span class="item">PVC</span><span class="item">우레탄</span><span class="item">아크릴차수</span></div></div>
        <div class="pdl4-card"><div class="icon">🎨</div><div class="name">도장재</div><div class="count">22종</div><div class="items"><span class="item">바인더</span><span class="item">플러스</span><span class="item">에폭시</span><span class="item">엠보라이닝</span><span class="item">금속코팅</span></div></div>
        <div class="pdl4-card"><div class="icon">🔧</div><div class="name">균열 보수재</div><div class="count">18종</div><div class="items"><span class="item">하이퍼티</span><span class="item">파우더</span><span class="item">HOOKER</span><span class="item">균열 젤</span></div></div>
        <div class="pdl4-card"><div class="icon">🛡️</div><div class="name">코팅·단열</div><div class="count">15종</div><div class="items"><span class="item">차열 코팅</span><span class="item">단열재</span><span class="item">함침재</span></div></div>
        <div class="pdl4-card"><div class="icon">🛠️</div><div class="name">시공 도구</div><div class="count">14종</div><div class="items"><span class="item">롤러</span><span class="item">붓</span><span class="item">스프레이</span><span class="item">교반기</span></div></div>
        <div class="pdl4-card"><div class="icon">🦺</div><div class="name">안전용품</div><div class="count">12종</div><div class="items"><span class="item">안전벨트</span><span class="item">고소장비</span><span class="item">보호구</span></div></div>
        <div class="pdl4-card"><div class="icon">📦</div><div class="name">부자재</div><div class="count">9종</div><div class="items"><span class="item">벤트</span><span class="item">트랩</span><span class="item">테이프</span><span class="item">접착제</span></div></div>
        <div class="pdl4-card"><div class="icon">🎁</div><div class="name">패키지 상품</div><div class="count">7종</div><div class="items"><span class="item">옥상 풀세트</span><span class="item">외벽 패키지</span><span class="item">셀프 키트</span></div></div>
      </div>
    </div>
  </section>`;

  const SEED_DL_FLOW_HTML = `<style>
  .pdl5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pdl5 { background:#FFFBF5; padding:80px 18px; }
  .pdl5-inner { max-width:1100px; margin:0 auto; }
  .pdl5-head { text-align:center; margin-bottom:40px; }
  .pdl5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pdl5-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .pdl5-head p { font-size:14px; color:#6B7280; }
  .pdl5-flow { display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; position:relative; }
  .pdl5-flow::before { content:''; position:absolute; top:38px; left:10%; right:10%; height:2px; background:linear-gradient(90deg, #FED7AA, #F97316, #FED7AA); z-index:0; }
  .pdl5-step { position:relative; z-index:1; text-align:center; }
  .pdl5-step .num { width:76px; height:76px; margin:0 auto 14px; border-radius:50%; background:#fff; border:3px solid #F97316; display:grid; place-items:center; font-family:'Bebas Neue',sans-serif; font-size:24px; font-weight:900; color:#F97316; box-shadow:0 8px 20px rgba(249,115,22,.15); letter-spacing:.5px; }
  .pdl5-step .name { font-size:14px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .pdl5-step .desc { font-size:11.5px; color:#6B7280; line-height:1.55; }
  .pdl5-step .duration { display:inline-block; margin-top:8px; padding:3px 8px; background:#fff; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:800; border-radius:5px; }
  @media (max-width:880px) { .pdl5-flow { grid-template-columns:1fr; gap:24px; } .pdl5-flow::before { display:none; } .pdl5-head h2 { font-size:24px; } }
  </style>
  <section class="pdl5">
    <div class="pdl5-inner">
      <div class="pdl5-head">
        <div class="kicker">PROCESS</div>
        <h2>대리점 개설 진행 절차</h2>
        <p>신청부터 오픈까지 평균 영업일 기준 21일</p>
      </div>
      <div class="pdl5-flow">
        <div class="pdl5-step"><div class="num">01</div><div class="name">신청·서류</div><div class="desc">신청서 + 사업자<br/>+ 매장 사진</div><div class="duration">즉시</div></div>
        <div class="pdl5-step"><div class="num">02</div><div class="name">권역 검토</div><div class="desc">기존 대리점과<br/>중복 여부 확인</div><div class="duration">3-5일</div></div>
        <div class="pdl5-step"><div class="num">03</div><div class="name">실사 방문</div><div class="desc">매장·창고 실사<br/>+ 대표 면담</div><div class="duration">5-7일</div></div>
        <div class="pdl5-step"><div class="num">04</div><div class="name">계약·재고</div><div class="desc">대리점 계약<br/>+ 초도 재고 입고</div><div class="duration">10-14일</div></div>
        <div class="pdl5-step"><div class="num">05</div><div class="name">오픈·교육</div><div class="desc">매장 셋업 + 교육<br/>+ 첫 매출 시작</div><div class="duration">14-21일</div></div>
      </div>
    </div>
  </section>`;

  const SEED_DL_FORM_HTML = `<style>
  .pdl6 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pdl6 { background:#fff; padding:80px 18px; }
  .pdl6-inner { max-width:980px; margin:0 auto; }
  .pdl6-head { text-align:center; margin-bottom:32px; }
  .pdl6-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pdl6-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pdl6-head p { font-size:14px; color:#6B7280; }
  .pdl6-card { background:#fff; border:1px solid #F3F4F6; border-radius:24px; padding:36px 32px; box-shadow:0 12px 36px rgba(15,31,92,.06); }
  .pdl6-section { margin-bottom:24px; }
  .pdl6-section .stitle { font-size:13px; font-weight:900; color:#0F1F5C; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid #FFEDD5; letter-spacing:-.3px; }
  .pdl6-row { margin-bottom:14px; }
  .pdl6-row.split { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .pdl6-row label { display:block; font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .pdl6-row input, .pdl6-row select, .pdl6-row textarea { width:100%; padding:12px 14px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:10px; font-size:14px; font-family:inherit; color:#0F1F5C; transition:all .2s; }
  .pdl6-row textarea { min-height:96px; resize:vertical; }
  .pdl6-row input:focus, .pdl6-row select:focus, .pdl6-row textarea:focus { outline:none; border-color:#FED7AA; background:#fff; box-shadow:0 0 0 3px rgba(249,115,22,.08); }
  .pdl6-agree { display:flex; align-items:center; gap:8px; margin-bottom:18px; padding:14px; background:#FFFBF5; border-radius:10px; font-size:12.5px; color:#4B5563; }
  .pdl6-agree input { width:16px; height:16px; accent-color:#F97316; }
  .pdl6-submit { width:100%; padding:16px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; }
  .pdl6-submit:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  @media (max-width:640px) { .pdl6-card { padding:24px 18px; } .pdl6-row.split { grid-template-columns:1fr; } .pdl6-head h2 { font-size:24px; } }
  </style>
  <section class="pdl6" id="dealer-form">
    <div class="pdl6-inner">
      <div class="pdl6-head">
        <div class="kicker">APPLICATION</div>
        <h2>대리점 신청서</h2>
        <p>아래 정보 제출 후 영업일 기준 5-7일 내 회신드립니다</p>
      </div>
      <form class="pdl6-card" id="pdl6-form" onsubmit="return false;">
        <div class="pdl6-section">
          <div class="stitle">📋 신청자 정보</div>
          <div class="pdl6-row split">
            <div><label>회사/상호명 *</label><input type="text" id="pdl6-company" placeholder="○○건축자재"/></div>
            <div><label>사업자등록번호</label><input type="text" id="pdl6-bn" placeholder="000-00-00000"/></div>
          </div>
          <div class="pdl6-row split">
            <div><label>대표자명 *</label><input type="text" id="pdl6-ceo" placeholder="홍길동"/></div>
            <div><label>연락처 *</label><input type="text" id="pdl6-phone" placeholder="010-0000-0000"/></div>
          </div>
          <div class="pdl6-row"><label>이메일</label><input type="email" id="pdl6-email" placeholder="example@email.com"/></div>
        </div>
        <div class="pdl6-section">
          <div class="stitle">🏪 매장·재고 정보</div>
          <div class="pdl6-row"><label>매장 주소</label><input type="text" id="pdl6-addr" placeholder="○○도 ○○시 ○○로"/></div>
          <div class="pdl6-row split">
            <div><label>매장 규모</label><select id="pdl6-store"><option>33-66㎡</option><option>66-99㎡</option><option>99-165㎡</option><option>165㎡ 이상</option></select></div>
            <div><label>창고 규모</label><select id="pdl6-wh"><option>창고 없음</option><option>33㎡ 미만</option><option>33-66㎡</option><option>66㎡ 이상</option></select></div>
          </div>
          <div class="pdl6-row"><label>희망 권역</label><input type="text" id="pdl6-region" placeholder="예: 경기 남부 / 부산 해운대 일대"/></div>
        </div>
        <div class="pdl6-section">
          <div class="stitle">📊 사업 정보</div>
          <div class="pdl6-row split">
            <div><label>건설자재 유통 경력</label><select id="pdl6-career"><option>없음</option><option>3년 미만</option><option>3-5년</option><option>5-10년</option><option>10년 이상</option></select></div>
            <div><label>예상 월 매출 목표</label><select id="pdl6-target"><option>1천만원 미만</option><option>1천-3천만원</option><option>3천-5천만원</option><option>5천만원 이상</option></select></div>
          </div>
          <div class="pdl6-row"><label>주요 거래처·실적 (간단 기재)</label><textarea id="pdl6-record" placeholder="기존 거래처·취급 자재·시공사 네트워크 등"></textarea></div>
        </div>
        <div class="pdl6-agree"><input type="checkbox" id="ag3"/><label for="ag3">개인정보·기업정보 수집·이용에 동의합니다</label></div>
        <div id="pdl6-msg" style="display:none;margin-bottom:10px;padding:12px 14px;border-radius:9px;font-size:13px;font-weight:700;"></div>
        <button type="button" id="pdl6-submit-btn" class="pdl6-submit">대리점 신청하기</button>
      </form>
    </div>
  </section>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script>
(function(){
  if (!window.firebase) { console.warn('[pdl6] Firebase SDK 로드 실패'); return; }
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU',
      authDomain: 'pour-app-new.firebaseapp.com',
      projectId: 'pour-app-new',
      storageBucket: 'pour-app-new.firebasestorage.app',
      messagingSenderId: '411031141847',
      appId: '1:411031141847:web:e658174fd4b9652cdadf92'
    });
  }
  var db = firebase.firestore();
  var root = document.querySelector('.pdl6');
  if (!root) return;

  function showMsg(text, type){
    var el = root.querySelector('#pdl6-msg');
    el.textContent = text;
    el.style.display = 'block';
    if (type === 'success') { el.style.background = '#ECFDF5'; el.style.border = '1px solid #A7F3D0'; el.style.color = '#047857'; }
    else { el.style.background = '#FEE2E2'; el.style.border = '1px solid #FCA5A5'; el.style.color = '#DC2626'; }
  }

  root.querySelector('#pdl6-submit-btn').addEventListener('click', async function(){
    var company = root.querySelector('#pdl6-company').value.trim();
    var ceo = root.querySelector('#pdl6-ceo').value.trim();
    var phone = root.querySelector('#pdl6-phone').value.trim();
    var agree = root.querySelector('#ag3').checked;
    if (!company || !ceo || !phone) { showMsg('회사명, 대표자명, 연락처는 필수입니다', 'error'); return; }
    if (!agree) { showMsg('개인정보·기업정보 수집·이용 동의가 필요합니다', 'error'); return; }

    var data = {
      type: '대리점 신청',
      brand: 'pourstore',
      companyName: company,
      businessNumber: root.querySelector('#pdl6-bn').value.trim(),
      representative: ceo,
      contactPhone: phone,
      contactEmail: root.querySelector('#pdl6-email').value.trim(),
      address: root.querySelector('#pdl6-addr').value.trim(),
      storeSize: root.querySelector('#pdl6-store').value || '',
      warehouseSize: root.querySelector('#pdl6-wh').value || '',
      desiredRegion: root.querySelector('#pdl6-region').value.trim(),
      experience: root.querySelector('#pdl6-career').value || '',
      monthlyTarget: root.querySelector('#pdl6-target').value || '',
      record: root.querySelector('#pdl6-record').value.trim(),
      status: '신규',
      source: 'pourstore-site',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    var btn = root.querySelector('#pdl6-submit-btn');
    btn.disabled = true; btn.textContent = '신청 중...';
    try {
      await db.collection('dealer-inquiries').add(data);
      showMsg('✅ 대리점 신청이 접수되었습니다. 영업일 기준 5-7일 내 검토 후 연락드립니다.', 'success');
      btn.textContent = '✓ 신청 완료';
      setTimeout(function(){ root.querySelector('#pdl6-form').reset(); btn.disabled = false; btn.textContent = '대리점 신청하기'; root.querySelector('#pdl6-msg').style.display = 'none'; }, 5000);
    } catch (e) {
      console.error('[pdl6]', e);
      showMsg('❌ 신청 실패: ' + e.message + ' — 잠시 후 다시 시도해 주세요', 'error');
      btn.disabled = false; btn.textContent = '대리점 신청하기';
    }
  });
})();
</script>`;

  const SEED_DL_FAQ_HTML = `<style>
  .pdl7 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pdl7 { background:#FFFBF5; padding:80px 18px; }
  .pdl7-inner { max-width:880px; margin:0 auto; }
  .pdl7-head { text-align:center; margin-bottom:32px; }
  .pdl7-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pdl7-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pdl7-list { display:flex; flex-direction:column; gap:12px; }
  .pdl7-item { background:#fff; border:1px solid #F3F4F6; border-radius:14px; overflow:hidden; transition:all .2s; }
  .pdl7-item:hover { border-color:#FED7AA; }
  .pdl7-item.open { border-color:#F97316; box-shadow:0 8px 24px rgba(249,115,22,.1); }
  .pdl7-q { display:flex; align-items:center; gap:14px; padding:18px 22px; cursor:pointer; }
  .pdl7-q .num { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-family:'Bebas Neue',sans-serif; font-size:14px; font-weight:900; color:#EA580C; flex-shrink:0; }
  .pdl7-q .text { flex:1; font-size:14.5px; font-weight:800; color:#0F1F5C; letter-spacing:-.3px; }
  .pdl7-q .arrow { color:#9CA3AF; font-size:14px; transition:transform .2s; }
  .pdl7-item.open .pdl7-q .arrow { transform:rotate(180deg); color:#EA580C; }
  .pdl7-a { padding:0 22px 20px 68px; font-size:13.5px; color:#4B5563; line-height:1.75; display:none; }
  .pdl7-item.open .pdl7-a { display:block; }
  .pdl7-a b { color:#0F1F5C; font-weight:800; }
  @media (max-width:640px) { .pdl7-head h2 { font-size:24px; } .pdl7-a { padding-left:22px; } }
  </style>
  <section class="pdl7">
    <div class="pdl7-inner">
      <div class="pdl7-head">
        <div class="kicker">FAQ</div>
        <h2>대리점 개설 자주 묻는 질문</h2>
      </div>
      <div class="pdl7-list">
        <div class="pdl7-item open">
          <div class="pdl7-q"><div class="num">Q1</div><div class="text">전속 영업권은 어떻게 보장되나요?</div><div class="arrow">▼</div></div>
          <div class="pdl7-a">GOLD 등급부터 <b>지역 단독 영업권</b>이 부여됩니다. 권역은 시·군·구 단위로 설정되며 동일 권역 내 신규 대리점은 받지 않습니다. 다만 공정 경쟁을 위해 매년 매출 목표 미달 시 권역 조정이 있을 수 있습니다.</div>
        </div>
        <div class="pdl7-item">
          <div class="pdl7-q"><div class="num">Q2</div><div class="text">초기 재고 매입은 의무인가요?</div><div class="arrow">▼</div></div>
          <div class="pdl7-a">네, <b>초기 재고 1천만원 매입이 필수</b>입니다. 다만 판매되지 않은 재고는 <b>1년 내 100% 환불·교환 가능</b>합니다.</div>
        </div>
        <div class="pdl7-item">
          <div class="pdl7-q"><div class="num">Q3</div><div class="text">기존 페인트 가게도 대리점 신청 가능한가요?</div><div class="arrow">▼</div></div>
          <div class="pdl7-a">가능합니다. 오히려 <b>기존 건설자재 유통 경험은 가점 요인</b>입니다. 다만 경쟁 자재 브랜드와 동시 취급은 협의가 필요합니다 (POUR 매대 분리 진열 등).</div>
        </div>
        <div class="pdl7-item">
          <div class="pdl7-q"><div class="num">Q4</div><div class="text">결제·정산은 어떻게 이루어지나요?</div><div class="arrow">▼</div></div>
          <div class="pdl7-a">대리점은 <b>본사로부터 직공급가에 매입 후 자체 마진을 붙여 판매</b>합니다. 매입대금은 <b>월 1회 정산</b>되며, 신용도에 따라 외상 한도가 부여됩니다 (초기 한도 500만원).</div>
        </div>
        <div class="pdl7-item">
          <div class="pdl7-q"><div class="num">Q5</div><div class="text">대리점 폐업·해지는 자유로운가요?</div><div class="arrow">▼</div></div>
          <div class="pdl7-a">네. <b>3개월 사전 통지 후 자유롭게 해지</b> 가능합니다. 잔여 재고는 본사가 70% 가격으로 매입 환수합니다. 부당한 일방 해지는 본사도 하지 않습니다.</div>
        </div>
        <div class="pdl7-item">
          <div class="pdl7-q"><div class="num">Q6</div><div class="text">광고·홍보는 본사가 지원하나요?</div><div class="arrow">▼</div></div>
          <div class="pdl7-a">SILVER는 카탈로그·POP 무상 제공, GOLD는 <b>지역 광고비 50% 분담</b>, PLATINUM은 <b>100% 본사 부담</b>입니다. 온라인 광고도 등급별 차등 지원합니다.</div>
        </div>
      </div>
    </div>
  </section>`;


  const SEED_MT_HERO_HTML = `<style>
  .pmt1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmt1 { background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 100%); padding:88px 18px 56px; position:relative; overflow:hidden; }
  .pmt1::before { content:''; position:absolute; top:-100px; right:-80px; width:420px; height:420px; background:radial-gradient(circle, rgba(249,115,22,.14) 0%, transparent 60%); border-radius:50%; }
  .pmt1-inner { max-width:1200px; margin:0 auto; position:relative; z-index:1; }
  .pmt1-top { text-align:center; margin-bottom:36px; }
  .pmt1-tag { display:inline-flex; gap:6px; padding:6px 14px; background:#fff; border:1px solid #FED7AA; color:#EA580C; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:18px; box-shadow:0 4px 12px rgba(249,115,22,.1); }
  .pmt1 h1 { font-size:46px; font-weight:900; color:#0F1F5C; line-height:1.2; margin-bottom:16px; letter-spacing:-1.4px; }
  .pmt1 h1 .accent { color:#F97316; }
  .pmt1-desc { font-size:16px; color:#4B5563; line-height:1.75; max-width:620px; margin:0 auto 32px; }
  .pmt1-cta { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  .pmt1-cta .primary { padding:14px 32px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer; text-decoration:none; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; }
  .pmt1-cta .primary:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  .pmt1-preview { background:#fff; border-radius:24px; padding:32px 28px; box-shadow:0 18px 48px rgba(15,31,92,.08); border:1px solid #F3F4F6; }
  .pmt1-preview .label { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:14px; text-align:center; }
  .pmt1-flow { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
  .pmt1-step { text-align:center; }
  .pmt1-step .icon { width:44px; height:44px; margin:0 auto 8px; border-radius:50%; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:20px; }
  .pmt1-step .name { font-size:12px; font-weight:800; color:#0F1F5C; }
  .pmt1-step .time { font-size:10px; color:#9CA3AF; font-weight:700; margin-top:2px; }
  @media (max-width:880px) { .pmt1 h1 { font-size:30px; } .pmt1-flow { grid-template-columns:repeat(2,1fr); gap:14px; } }
  </style>
  <section class="pmt1">
    <div class="pmt1-inner">
      <div class="pmt1-top">
        <span class="pmt1-tag">🤝 SMART MATCHING</span>
        <h1>최적의 시공사,<br/><span class="accent">3분이면 매칭됩니다</span></h1>
        <p class="pmt1-desc">지역·건물·문제·예산만 입력하면 — POUR가 검증한 250+ 파트너사 중 가장 가까운 우수 시공사 3곳을 추천드립니다.</p>
        <div class="pmt1-cta">
          <a class="primary" href="#match-form">시공 연결 신청 →</a>
        </div>
      </div>
      <div class="pmt1-preview">
        <div class="label">📍 매칭 절차 미리보기</div>
        <div class="pmt1-flow">
          <div class="pmt1-step"><div class="icon">📝</div><div class="name">신청</div><div class="time">3분</div></div>
          <div class="pmt1-step"><div class="icon">🤖</div><div class="name">AI 매칭</div><div class="time">즉시</div></div>
          <div class="pmt1-step"><div class="icon">📞</div><div class="name">파트너 추천</div><div class="time">1-2일</div></div>
          <div class="pmt1-step"><div class="icon">🔍</div><div class="name">현장 진단</div><div class="time">3-5일</div></div>
          <div class="pmt1-step"><div class="icon">🏗️</div><div class="name">시공 시작</div><div class="time">7-14일</div></div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_MT_METHOD_HTML = `<style>
  .pmt2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmt2 { background:#fff; padding:80px 18px; }
  .pmt2-inner { max-width:1200px; margin:0 auto; }
  .pmt2-head { text-align:center; margin-bottom:36px; }
  .pmt2-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pmt2-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .pmt2-head p { font-size:14px; color:#6B7280; }
  .pmt2-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
  .pmt2-card { background:#fff; border:1px solid #F3F4F6; border-radius:16px; padding:22px 20px; transition:all .25s; cursor:pointer; }
  .pmt2-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .pmt2-card .icon { width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:24px; margin-bottom:12px; }
  .pmt2-card .name { font-size:14.5px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .pmt2-card .desc { font-size:12px; color:#6B7280; line-height:1.6; margin-bottom:10px; min-height:38px; }
  .pmt2-card .meta { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:800; color:#EA580C; }
  .pmt2-card .meta .dot { width:4px; height:4px; border-radius:50%; background:#FED7AA; }
  @media (max-width:640px) { .pmt2-head h2 { font-size:24px; } }
  </style>
  <section class="pmt2">
    <div class="pmt2-inner">
      <div class="pmt2-head">
        <div class="kicker">SUPPORTED METHODS</div>
        <h2>시공 가능한 공법</h2>
        <p>방수·도장·균열·토목 — 어떤 문제든 검증된 공법으로 매칭됩니다</p>
      </div>
      <div class="pmt2-grid">
        <div class="pmt2-card"><div class="icon">💧</div><div class="name">슬라브 듀얼강화방수</div><div class="desc">옥상 슬라브 누수 + 콘크리트 중성화</div><div class="meta">182건 사례<span class="dot"></span>5-10년 보증</div></div>
        <div class="pmt2-card"><div class="icon">🏠</div><div class="name">아스팔트슁글 방수</div><div class="desc">박공지붕 누수·강풍 탈락 방지 (1026호)</div><div class="meta">96건 사례<span class="dot"></span>10년 보증</div></div>
        <div class="pmt2-card"><div class="icon">🔩</div><div class="name">금속기와 방수</div><div class="desc">맞물림 풀림·강판 부식 + HOOKER 보강</div><div class="meta">78건 사례<span class="dot"></span>7년 보증</div></div>
        <div class="pmt2-card"><div class="icon">🎨</div><div class="name">외벽 균열 보수·재도장</div><div class="desc">고급/중급/경제 — 예산별 3단계 차등</div><div class="meta">152건 사례<span class="dot"></span>3-7년 보증</div></div>
        <div class="pmt2-card"><div class="icon">🚗</div><div class="name">에폭시·엠보라이닝</div><div class="desc">지하주차장 바닥 + MMA 논슬립 시공</div><div class="meta">68건 사례<span class="dot"></span>5년 보증</div></div>
        <div class="pmt2-card"><div class="icon">🌊</div><div class="name">아크릴 배면차수</div><div class="desc">지하·수조 누수 — 초고압 주입</div><div class="meta">42건 사례<span class="dot"></span>10년 보증</div></div>
        <div class="pmt2-card"><div class="icon">🛣️</div><div class="name">아스콘 도로 포장</div><div class="desc">포트홀·균열 보수 + 씰코팅</div><div class="meta">36건 사례<span class="dot"></span>3년 보증</div></div>
        <div class="pmt2-card"><div class="icon">🛡️</div><div class="name">보수·보강 (단면)</div><div class="desc">박락·철근 노출 — 탄성강화 파우더</div><div class="meta">46건 사례<span class="dot"></span>5년 보증</div></div>
      </div>
    </div>
  </section>`;

  const SEED_MT_FORM_HTML = `<style>
  .pmt3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmt3 { background:#FFFBF5; padding:80px 18px; }
  .pmt3-inner { max-width:980px; margin:0 auto; }
  .pmt3-head { text-align:center; margin-bottom:32px; }
  .pmt3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pmt3-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pmt3-head p { font-size:14px; color:#6B7280; }
  .pmt3-card { background:#fff; border:1px solid #F3F4F6; border-radius:24px; padding:36px 32px; box-shadow:0 12px 36px rgba(15,31,92,.06); }
  .pmt3-section { margin-bottom:24px; }
  .pmt3-section .stitle { font-size:13px; font-weight:900; color:#0F1F5C; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid #FFEDD5; letter-spacing:-.3px; }
  .pmt3-row { margin-bottom:14px; }
  .pmt3-row.split { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .pmt3-row label { display:block; font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .pmt3-row input, .pmt3-row select, .pmt3-row textarea { width:100%; padding:12px 14px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:10px; font-size:14px; font-family:inherit; color:#0F1F5C; transition:all .2s; }
  .pmt3-row textarea { min-height:96px; resize:vertical; }
  .pmt3-row input:focus, .pmt3-row select:focus, .pmt3-row textarea:focus { outline:none; border-color:#FED7AA; background:#fff; box-shadow:0 0 0 3px rgba(249,115,22,.08); }
  .pmt3-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .pmt3-chip { padding:8px 14px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:999px; font-size:12.5px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; }
  .pmt3-chip:hover { border-color:#FED7AA; }
  .pmt3-chip.active { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-color:transparent; box-shadow:0 4px 12px rgba(249,115,22,.25); }
  .pmt3-budget { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px; }
  .pmt3-budget-item { padding:14px 12px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:10px; text-align:center; cursor:pointer; transition:all .2s; }
  .pmt3-budget-item:hover { border-color:#FED7AA; }
  .pmt3-budget-item.active { background:#FFF7ED; border-color:#F97316; }
  .pmt3-budget-item .v { font-family:'Bebas Neue',sans-serif; font-size:18px; font-weight:900; color:#F97316; letter-spacing:.5px; }
  .pmt3-budget-item .l { font-size:11px; color:#6B7280; font-weight:700; margin-top:2px; }
  .pmt3-agree { display:flex; align-items:center; gap:8px; margin-bottom:18px; padding:14px; background:#FFFBF5; border-radius:10px; font-size:12.5px; color:#4B5563; }
  .pmt3-agree input { width:16px; height:16px; accent-color:#F97316; }
  .pmt3-submit { width:100%; padding:16px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; }
  .pmt3-submit:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  @media (max-width:640px) { .pmt3-card { padding:24px 18px; } .pmt3-row.split { grid-template-columns:1fr; } .pmt3-head h2 { font-size:24px; } }
  </style>
  <section class="pmt3" id="match-form">
    <div class="pmt3-inner">
      <div class="pmt3-head">
        <div class="kicker">REQUEST FORM</div>
        <h2>시공 연결 신청서</h2>
        <p>아래 정보 입력 후 영업일 기준 1-2일 내 추천 파트너사가 연락드립니다</p>
      </div>
      <form class="pmt3-card" id="pmt3-form" onsubmit="return false;">
        <div class="pmt3-section">
          <div class="stitle">📍 1. 지역·건물 유형</div>
          <div class="pmt3-row split">
            <div><label>지역</label><select id="pmt3-region"><option value="">선택</option><option>서울</option><option>경기</option><option>인천</option><option>부산</option><option>대구</option><option>광주</option><option>대전</option><option>기타</option></select></div>
            <div><label>건물 유형</label><select id="pmt3-building"><option value="">선택</option><option>아파트</option><option>관공서</option><option>학교·병원</option><option>상가·오피스</option><option>공장·창고</option><option>주택</option></select></div>
          </div>
        </div>
        <div class="pmt3-section">
          <div class="stitle">🔧 2. 문제·필요한 공법 (복수 선택)</div>
          <div class="pmt3-chips" id="pmt3-methods">
            <button type="button" class="pmt3-chip active" data-v="옥상 누수">옥상 누수</button>
            <button type="button" class="pmt3-chip" data-v="외벽 균열">외벽 균열</button>
            <button type="button" class="pmt3-chip" data-v="지하 누수">지하 누수</button>
            <button type="button" class="pmt3-chip" data-v="지하주차장">지하주차장</button>
            <button type="button" class="pmt3-chip" data-v="슁글 지붕">슁글 지붕</button>
            <button type="button" class="pmt3-chip" data-v="금속기와">금속기와</button>
            <button type="button" class="pmt3-chip" data-v="결로·곰팡이">결로·곰팡이</button>
            <button type="button" class="pmt3-chip" data-v="아스콘·도로">아스콘·도로</button>
            <button type="button" class="pmt3-chip" data-v="기타">기타</button>
          </div>
        </div>
        <div class="pmt3-section">
          <div class="stitle">💰 3. 예상 예산 범위</div>
          <div class="pmt3-budget" id="pmt3-budget">
            <div class="pmt3-budget-item" data-v="~500"><div class="v">~500</div><div class="l">만원</div></div>
            <div class="pmt3-budget-item active" data-v="500-2000"><div class="v">500-2K</div><div class="l">만원</div></div>
            <div class="pmt3-budget-item" data-v="2000-5000"><div class="v">2K-5K</div><div class="l">만원</div></div>
            <div class="pmt3-budget-item" data-v="5000-10000"><div class="v">5K-1억</div><div class="l">원</div></div>
            <div class="pmt3-budget-item" data-v="10000+"><div class="v">1억+</div><div class="l">원</div></div>
          </div>
        </div>
        <div class="pmt3-section">
          <div class="stitle">📝 4. 상세 내용</div>
          <div class="pmt3-row"><label>문제 상황·시급도</label><textarea id="pmt3-desc" placeholder="누수 위치, 발생 시기, 진행 정도, 희망 시공 일정 등"></textarea></div>
        </div>
        <div class="pmt3-section">
          <div class="stitle">📞 5. 연락처</div>
          <div class="pmt3-row split">
            <div><label>성함 *</label><input type="text" id="pmt3-name" placeholder="홍길동"/></div>
            <div><label>연락처 *</label><input type="text" id="pmt3-phone" placeholder="010-0000-0000"/></div>
          </div>
          <div class="pmt3-row"><label>주소 (현장 위치)</label><input type="text" id="pmt3-addr" placeholder="○○도 ○○시 ○○로"/></div>
        </div>
        <div class="pmt3-agree"><input type="checkbox" id="ag4"/><label for="ag4">개인정보 수집·이용 및 추천 파트너사 정보 공유에 동의합니다</label></div>
        <div id="pmt3-msg" style="display:none;margin-bottom:10px;padding:12px 14px;border-radius:9px;font-size:13px;font-weight:700;"></div>
        <button type="button" id="pmt3-submit-btn" class="pmt3-submit">시공 연결 신청하기</button>
      </form>
    </div>
  </section>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script>
(function(){
  if (!window.firebase) { console.warn('[pmt3] Firebase SDK 로드 실패'); return; }
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU',
      authDomain: 'pour-app-new.firebaseapp.com',
      projectId: 'pour-app-new',
      storageBucket: 'pour-app-new.firebasestorage.app',
      messagingSenderId: '411031141847',
      appId: '1:411031141847:web:e658174fd4b9652cdadf92'
    });
  }
  var db = firebase.firestore();
  var root = document.getElementById('match-form');
  if (!root) return;

  // chip 토글
  root.querySelectorAll('#pmt3-methods .pmt3-chip').forEach(function(b){
    b.addEventListener('click', function(){ b.classList.toggle('active'); });
  });
  root.querySelectorAll('#pmt3-budget .pmt3-budget-item').forEach(function(b){
    b.addEventListener('click', function(){
      root.querySelectorAll('#pmt3-budget .pmt3-budget-item').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
    });
  });

  function showMsg(text, type){
    var el = root.querySelector('#pmt3-msg');
    el.textContent = text;
    el.style.display = 'block';
    if (type === 'success') { el.style.background = '#ECFDF5'; el.style.border = '1px solid #A7F3D0'; el.style.color = '#047857'; }
    else { el.style.background = '#FEE2E2'; el.style.border = '1px solid #FCA5A5'; el.style.color = '#DC2626'; }
  }

  root.querySelector('#pmt3-submit-btn').addEventListener('click', async function(){
    var name = root.querySelector('#pmt3-name').value.trim();
    var phone = root.querySelector('#pmt3-phone').value.trim();
    var agree = root.querySelector('#ag4').checked;
    if (!name || !phone) { showMsg('성함과 연락처는 필수입니다', 'error'); return; }
    if (!agree) { showMsg('개인정보 수집·이용 동의가 필요합니다', 'error'); return; }

    var methods = Array.from(root.querySelectorAll('#pmt3-methods .pmt3-chip.active')).map(function(b){return b.dataset.v;});
    var budgetEl = root.querySelector('#pmt3-budget .pmt3-budget-item.active');
    var data = {
      customerName: name,
      customerPhone: phone,
      region: root.querySelector('#pmt3-region').value || '',
      buildingType: root.querySelector('#pmt3-building').value || '',
      methods: methods,
      estimatedBudget: budgetEl ? budgetEl.dataset.v : '',
      description: root.querySelector('#pmt3-desc').value.trim(),
      address: root.querySelector('#pmt3-addr').value.trim(),
      status: '신규',
      source: 'pourstore-site',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    var btn = root.querySelector('#pmt3-submit-btn');
    btn.disabled = true; btn.textContent = '신청 중...';
    try {
      await db.collection('matching-requests').add(data);
      showMsg('✅ 신청이 접수되었습니다. 영업일 기준 1-2일 내 연락드립니다.', 'success');
      btn.textContent = '✓ 신청 완료';
      // 폼 리셋 (선택)
      setTimeout(function(){ root.querySelector('#pmt3-form').reset(); btn.disabled = false; btn.textContent = '시공 연결 신청하기'; var msg = root.querySelector('#pmt3-msg'); msg.style.display = 'none'; }, 4000);
    } catch (e) {
      console.error('[pmt3]', e);
      showMsg('❌ 전송 실패: ' + e.message + ' — 잠시 후 다시 시도해 주세요', 'error');
      btn.disabled = false; btn.textContent = '시공 연결 신청하기';
    }
  });
})();
</script>`;

  const SEED_MT_FLOW_HTML = `<style>
  .pmt4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmt4 { background:#fff; padding:80px 18px; }
  .pmt4-inner { max-width:1100px; margin:0 auto; }
  .pmt4-head { text-align:center; margin-bottom:40px; }
  .pmt4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pmt4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pmt4-head p { font-size:14px; color:#6B7280; max-width:560px; margin:0 auto; }
  .pmt4-list { display:flex; flex-direction:column; gap:12px; max-width:780px; margin:0 auto; }
  .pmt4-step { display:grid; grid-template-columns:auto 1fr auto; gap:18px; align-items:center; padding:22px 24px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:18px; transition:all .25s; }
  .pmt4-step:hover { border-color:#FED7AA; background:#fff; box-shadow:0 12px 28px rgba(15,31,92,.06); }
  .pmt4-step .num { width:54px; height:54px; border-radius:14px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; font-family:'Bebas Neue',sans-serif; font-size:22px; font-weight:900; display:grid; place-items:center; flex-shrink:0; box-shadow:0 6px 16px rgba(249,115,22,.3); letter-spacing:.5px; }
  .pmt4-step .text { flex:1; min-width:0; }
  .pmt4-step .name { font-size:16px; font-weight:900; color:#0F1F5C; margin-bottom:4px; letter-spacing:-.3px; }
  .pmt4-step .desc { font-size:13px; color:#6B7280; line-height:1.6; }
  .pmt4-step .duration { padding:6px 12px; background:#fff; border:1px solid #FED7AA; color:#EA580C; font-size:11.5px; font-weight:800; border-radius:8px; white-space:nowrap; }
  @media (max-width:640px) { .pmt4-step { grid-template-columns:auto 1fr; } .pmt4-step .duration { grid-column:1/-1; justify-self:start; } .pmt4-head h2 { font-size:24px; } }
  </style>
  <section class="pmt4">
    <div class="pmt4-inner">
      <div class="pmt4-head">
        <div class="kicker">FULL PROCESS</div>
        <h2>매칭 절차 자세히 보기</h2>
        <p>신청부터 시공 완료까지 — 단계별로 무엇이 진행되는지 명확하게</p>
      </div>
      <div class="pmt4-list">
        <div class="pmt4-step"><div class="num">01</div><div class="text"><div class="name">온라인 신청서 작성</div><div class="desc">지역·건물·문제·예산 입력 (3분 소요) — 사진 첨부 시 매칭 정확도 ↑</div></div><div class="duration">즉시</div></div>
        <div class="pmt4-step"><div class="num">02</div><div class="text"><div class="name">AI 매칭 + 본사 검토</div><div class="desc">지역·전문분야·이전 시공 만족도 기반 — 추천 파트너 3곳 자동 산출</div></div><div class="duration">접수 후 1시간</div></div>
        <div class="pmt4-step"><div class="num">03</div><div class="text"><div class="name">추천 파트너 안내</div><div class="desc">SMS·이메일로 추천 파트너 3곳 정보 발송 — 회사 소개·실적·평점 포함</div></div><div class="duration">1-2일</div></div>
        <div class="pmt4-step"><div class="num">04</div><div class="text"><div class="name">현장 무료 진단</div><div class="desc">선택한 파트너사가 현장 방문 — 진단·사진 촬영·견적서 작성 (무료)</div></div><div class="duration">3-5일</div></div>
        <div class="pmt4-step"><div class="num">05</div><div class="text"><div class="name">견적 비교·선택</div><div class="desc">3곳 견적 비교 — 가격·일정·시공 범위 검토 후 선택. 무리한 선택 강요 없음</div></div><div class="duration">5-10일</div></div>
        <div class="pmt4-step"><div class="num">06</div><div class="text"><div class="name">계약·시공 시작</div><div class="desc">계약 체결 + 일정 확정 — POUR 자재 직공급으로 시공 진행</div></div><div class="duration">7-14일</div></div>
        <div class="pmt4-step"><div class="num">07</div><div class="text"><div class="name">시공 완료·하자 보증</div><div class="desc">시공 검수 + 보증서 발급 — 5-10년 본사 하자 보증 (자재 결함 100% 책임)</div></div><div class="duration">완공 후</div></div>
      </div>
    </div>
  </section>`;

  const SEED_MT_NETWORK_HTML = `<style>
  .pmt5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmt5 { background:#FFFBF5; padding:72px 18px; }
  .pmt5-inner { max-width:1200px; margin:0 auto; }
  .pmt5-head { text-align:center; margin-bottom:32px; }
  .pmt5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pmt5-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .pmt5-head p { font-size:14px; color:#6B7280; }
  .pmt5-grid { display:grid; grid-template-columns:1.3fr 1fr; gap:20px; align-items:center; }
  .pmt5-map { aspect-ratio:1/1; background-image:url('https://placehold.co/600x600/0F1F5C/fff?text=KOREA+MAP'); background-size:cover; background-position:center; border-radius:24px; position:relative; overflow:hidden; box-shadow:0 18px 48px rgba(15,31,92,.15); }
  .pmt5-map .pin { position:absolute; padding:6px 12px; background:#fff; border-radius:20px; font-size:11px; font-weight:900; color:#0F1F5C; box-shadow:0 4px 12px rgba(0,0,0,.2); display:flex; align-items:center; gap:6px; }
  .pmt5-map .pin .dot { width:8px; height:8px; border-radius:50%; background:#F97316; box-shadow:0 0 0 4px rgba(249,115,22,.3); animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100% { box-shadow:0 0 0 4px rgba(249,115,22,.3); } 50% { box-shadow:0 0 0 8px rgba(249,115,22,.1); } }
  .pmt5-map .pin.p1 { top:20%; left:30%; }
  .pmt5-map .pin.p2 { top:35%; left:50%; }
  .pmt5-map .pin.p3 { top:55%; left:35%; }
  .pmt5-map .pin.p4 { top:70%; left:55%; }
  .pmt5-map .pin.p5 { top:80%; left:75%; }
  .pmt5-content .label { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:8px; }
  .pmt5-content h3 { font-size:24px; font-weight:900; color:#0F1F5C; line-height:1.3; margin-bottom:14px; letter-spacing:-.5px; }
  .pmt5-content p { font-size:14px; color:#4B5563; line-height:1.75; margin-bottom:20px; }
  .pmt5-stats { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .pmt5-stat { background:#fff; border:1px solid #F3F4F6; border-radius:14px; padding:18px 16px; }
  .pmt5-stat .v { font-family:'Bebas Neue',sans-serif; font-size:26px; font-weight:900; color:#F97316; line-height:1; letter-spacing:.5px; }
  .pmt5-stat .l { font-size:11.5px; color:#6B7280; margin-top:6px; font-weight:700; }
  @media (max-width:880px) { .pmt5-grid { grid-template-columns:1fr; } .pmt5-head h2 { font-size:24px; } }
  </style>
  <section class="pmt5">
    <div class="pmt5-inner">
      <div class="pmt5-head">
        <div class="kicker">NATIONWIDE NETWORK</div>
        <h2>전국 시공 네트워크</h2>
        <p>17개 광역시·도 모두 1-2일 내 방문 가능</p>
      </div>
      <div class="pmt5-grid">
        <div class="pmt5-map">
          <div class="pin p1"><span class="dot"></span>서울 38곳</div>
          <div class="pin p2"><span class="dot"></span>경기 52곳</div>
          <div class="pin p3"><span class="dot"></span>대전 18곳</div>
          <div class="pin p4"><span class="dot"></span>부산 32곳</div>
          <div class="pin p5"><span class="dot"></span>제주 8곳</div>
        </div>
        <div class="pmt5-content">
          <div class="label">17 REGIONS · 250+ PARTNERS</div>
          <h3>가장 가까운 우수 파트너가<br/>방문드립니다</h3>
          <p>POUR스토어는 전국 250+ 검증 파트너사 네트워크를 보유하고 있습니다. 신청자 위치를 기반으로 가장 가까운 우수 시공사를 자동 매칭합니다.</p>
          <div class="pmt5-stats">
            <div class="pmt5-stat"><div class="v">250+</div><div class="l">검증된 파트너사</div></div>
            <div class="pmt5-stat"><div class="v">17</div><div class="l">광역시·도 커버리지</div></div>
            <div class="pmt5-stat"><div class="v">1-2일</div><div class="l">현장 방문 소요</div></div>
            <div class="pmt5-stat"><div class="v">98.5%</div><div class="l">고객 만족도</div></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_MT_RECENT_HTML = `<style>
  .pmt6 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmt6 { background:#fff; padding:80px 18px; }
  .pmt6-inner { max-width:1200px; margin:0 auto; }
  .pmt6-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:14px; }
  .pmt6-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pmt6-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pmt6-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; background:#fff; transition:all .25s; }
  .pmt6-head .more:hover { background:#FFF7ED; }
  .pmt6-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px; }
  .pmt6-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; overflow:hidden; transition:all .3s; text-decoration:none; }
  .pmt6-card:hover { transform:translateY(-4px); box-shadow:0 20px 48px rgba(15,31,92,.1); border-color:#FED7AA; }
  .pmt6-thumb { aspect-ratio:4/3; background-size:cover; background-position:center; position:relative; }
  .pmt6-thumb .badge { position:absolute; top:10px; left:10px; padding:4px 9px; background:rgba(249,115,22,.92); color:#fff; font-size:10px; font-weight:900; border-radius:5px; letter-spacing:.3px; }
  .pmt6-info { padding:16px; }
  .pmt6-info .region { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .pmt6-info .name { font-size:14.5px; font-weight:900; color:#0F1F5C; margin-bottom:8px; line-height:1.4; letter-spacing:-.3px; }
  .pmt6-info .meta { display:flex; align-items:center; gap:8px; font-size:11.5px; color:#6B7280; padding-top:10px; border-top:1px solid #F3F4F6; font-weight:700; }
  .pmt6-info .meta .dot { width:3px; height:3px; border-radius:50%; background:#D1D5DB; }
  @media (max-width:640px) { .pmt6-head h2 { font-size:22px; } }
  </style>
  <section class="pmt6">
    <div class="pmt6-inner">
      <div class="pmt6-head">
        <div>
          <div class="kicker">RECENT WORK</div>
          <h2>최근 매칭으로 진행된 시공</h2>
        </div>
        <a class="more" href="https://www.pourstore.net/construction">전체 사례 →</a>
      </div>
      <div class="pmt6-grid">
        <a class="pmt6-card" href="#"><div class="pmt6-thumb" style="background-image:url('https://placehold.co/600x450/F97316/fff?text=SLAB')"><div class="badge">매칭 시공</div></div><div class="pmt6-info"><div class="region">📍 서울 강남구</div><div class="name">래미안 옥상 슬라브 방수 (2,400세대)</div><div class="meta"><span>SH건설</span><span class="dot"></span><span>2025.10 완공</span></div></div></a>
        <a class="pmt6-card" href="#"><div class="pmt6-thumb" style="background-image:url('https://placehold.co/600x450/EA580C/fff?text=SHINGLE')"><div class="badge">매칭 시공</div></div><div class="pmt6-info"><div class="region">📍 부산 해운대구</div><div class="name">해운대 푸르지오 슁글 방수</div><div class="meta"><span>부산테크</span><span class="dot"></span><span>2025.08 완공</span></div></div></a>
        <a class="pmt6-card" href="#"><div class="pmt6-thumb" style="background-image:url('https://placehold.co/600x450/0F1F5C/fff?text=PAINT')"><div class="badge">매칭 시공</div></div><div class="pmt6-info"><div class="region">📍 경기 수원시</div><div class="name">수원시청 외벽 균열 보수·재도장</div><div class="meta"><span>한울방수</span><span class="dot"></span><span>2025.09 완공</span></div></div></a>
        <a class="pmt6-card" href="#"><div class="pmt6-thumb" style="background-image:url('https://placehold.co/600x450/059669/fff?text=PARKING')"><div class="badge">매칭 시공</div></div><div class="pmt6-info"><div class="region">📍 인천 송도</div><div class="name">송도 컨벤시아 지하주차장 에폭시</div><div class="meta"><span>대성도장</span><span class="dot"></span><span>2025.07 완공</span></div></div></a>
      </div>
    </div>
  </section>`;

  const SEED_MT_REVIEW_HTML = `<style>
  .pmt7 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmt7 { background:#FFFBF5; padding:80px 18px; }
  .pmt7-inner { max-width:1200px; margin:0 auto; }
  .pmt7-head { text-align:center; margin-bottom:36px; }
  .pmt7-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pmt7-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .pmt7-head .score { display:inline-flex; align-items:center; gap:8px; padding:8px 16px; background:#fff; border:1px solid #FED7AA; border-radius:999px; font-size:13px; font-weight:800; color:#EA580C; }
  .pmt7-head .score b { font-family:'Bebas Neue',sans-serif; font-size:18px; }
  .pmt7-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px; }
  .pmt7-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:24px 22px; position:relative; transition:all .25s; }
  .pmt7-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .pmt7-card .stars { font-size:13px; color:#F59E0B; margin-bottom:10px; letter-spacing:1px; }
  .pmt7-card .text { font-size:13.5px; color:#374151; line-height:1.7; margin-bottom:18px; }
  .pmt7-card .text b { color:#0F1F5C; font-weight:800; }
  .pmt7-card .partner { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; background:#FFFBF5; border:1px solid #FED7AA; color:#EA580C; font-size:11px; font-weight:800; border-radius:6px; margin-bottom:14px; }
  .pmt7-card .author { display:flex; align-items:center; gap:10px; padding-top:14px; border-top:1px solid #F3F4F6; }
  .pmt7-card .avatar { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:13px; font-weight:900; color:#EA580C; }
  .pmt7-card .info .name { font-size:12.5px; font-weight:800; color:#0F1F5C; }
  .pmt7-card .info .role { font-size:11px; color:#9CA3AF; font-weight:700; margin-top:2px; }
  @media (max-width:640px) { .pmt7-head h2 { font-size:24px; } }
  </style>
  <section class="pmt7">
    <div class="pmt7-inner">
      <div class="pmt7-head">
        <div class="kicker">CUSTOMER REVIEWS</div>
        <h2>매칭 서비스 이용 후기</h2>
        <div class="score">⭐ 매칭 만족도 <b>4.8</b> / 5.0 · 누적 후기 280+</div>
      </div>
      <div class="pmt7-grid">
        <div class="pmt7-card"><div class="stars">★★★★★</div><span class="partner">🤝 SH건설 매칭</span><div class="text">3곳 견적 비교가 가능해서 좋았어요. 가격만이 아니라 일정·시공 범위까지 한눈에 볼 수 있어서 결정이 편했습니다. 시공 결과도 만족스럽습니다.</div><div class="author"><div class="avatar">김</div><div class="info"><div class="name">김○○ 관리소장</div><div class="role">서울 강남 · 1,200세대</div></div></div></div>
        <div class="pmt7-card"><div class="stars">★★★★★</div><span class="partner">🤝 한울방수 매칭</span><div class="text">관공서 발주라 절차가 복잡한데, 본사가 사전에 모든 서류를 챙겨주셔서 결재 올리기 편했어요. 매칭 파트너사도 책임감 있게 시공해주셨습니다.</div><div class="author"><div class="avatar">박</div><div class="info"><div class="name">박○○ 시설팀장</div><div class="role">경기 수원 · 시청사</div></div></div></div>
        <div class="pmt7-card"><div class="stars">★★★★★</div><span class="partner">🤝 부산테크 매칭</span><div class="text">슁글 지붕은 까다로워서 다른 곳에선 거절당했는데, POUR 매칭으로 신기술 시공 가능한 파트너 찾았습니다. 강풍에도 끄떡없네요.</div><div class="author"><div class="avatar">이</div><div class="info"><div class="name">이○○ 입주자대표</div><div class="role">부산 해운대 · 23층</div></div></div></div>
      </div>
    </div>
  </section>`;


  const SEED_SH_HERO_HTML = `<style>
  .psh1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .psh1 { background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 100%); padding:88px 18px 64px; position:relative; overflow:hidden; }
  .psh1::before { content:''; position:absolute; top:-100px; right:-80px; width:420px; height:420px; background:radial-gradient(circle, rgba(249,115,22,.14) 0%, transparent 60%); border-radius:50%; }
  .psh1-inner { max-width:1100px; margin:0 auto; text-align:center; position:relative; z-index:1; }
  .psh1-tag { display:inline-flex; gap:6px; padding:6px 14px; background:#fff; border:1px solid #FED7AA; color:#EA580C; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:20px; box-shadow:0 4px 12px rgba(249,115,22,.1); }
  .psh1 h1 { font-size:46px; font-weight:900; color:#0F1F5C; line-height:1.2; margin-bottom:18px; letter-spacing:-1.4px; }
  .psh1 h1 .accent { color:#F97316; }
  .psh1-desc { font-size:16px; color:#4B5563; line-height:1.75; max-width:640px; margin:0 auto 32px; }
  .psh1-cta { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  .psh1-cta .primary { padding:14px 28px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer; text-decoration:none; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; }
  .psh1-cta .primary:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  .psh1-cta .ghost { padding:14px 24px; background:#fff; color:#0F1F5C; border:1px solid #E5E7EB; border-radius:14px; font-size:14px; font-weight:800; text-decoration:none; }
  @media (max-width:640px) { .psh1 h1 { font-size:30px; } }
  </style>
  <section class="psh1">
    <div class="psh1-inner">
      <span class="psh1-tag">🏢 SHOWROOM EXPERIENCE</span>
      <h1>POUR스토어 쇼룸에서<br/><span class="accent">자재를 직접 체험하세요</span></h1>
      <p class="psh1-desc">110+ 제품을 직접 보고 만져볼 수 있는 평택 본사 쇼룸. 전문 상담사가 1:1로 시공·자재 상담을 도와드립니다 — 무료 방문 예약.</p>
      <div class="psh1-cta">
        <a class="primary" href="#booking-form">방문 예약 →</a>
        <a class="ghost" href="#location">찾아오시는 길</a>
      </div>
    </div>
  </section>`;

  const SEED_SH_LOCATION_HTML = `<style>
  .psh2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .psh2 { background:#fff; padding:80px 18px; }
  .psh2-inner { max-width:1200px; margin:0 auto; }
  .psh2-head { text-align:center; margin-bottom:36px; }
  .psh2-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .psh2-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .psh2-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:24px; }
  .psh2-map { aspect-ratio:5/4; background-image:url('https://placehold.co/800x640/0F1F5C/fff?text=PYEONGTAEK+MAP'); background-size:cover; background-position:center; border-radius:24px; position:relative; overflow:hidden; box-shadow:0 18px 48px rgba(15,31,92,.12); }
  .psh2-map .pin { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:48px; filter:drop-shadow(0 8px 16px rgba(0,0,0,.3)); }
  .psh2-map .overlay { position:absolute; bottom:18px; left:18px; right:18px; padding:18px 20px; background:rgba(255,255,255,.96); border-radius:14px; backdrop-filter:blur(8px); box-shadow:0 8px 24px rgba(0,0,0,.15); }
  .psh2-map .overlay .name { font-size:14px; font-weight:900; color:#0F1F5C; margin-bottom:4px; letter-spacing:-.3px; }
  .psh2-map .overlay .addr { font-size:12px; color:#6B7280; font-weight:700; }
  .psh2-info { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border:1px solid #FED7AA; border-radius:24px; padding:32px 28px; }
  .psh2-info .label { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:6px; }
  .psh2-info h3 { font-size:22px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; margin-bottom:18px; }
  .psh2-row { display:flex; align-items:flex-start; gap:14px; padding:14px 0; border-bottom:1px solid rgba(249,115,22,.15); }
  .psh2-row:last-child { border-bottom:none; }
  .psh2-row .icon { width:36px; height:36px; border-radius:10px; background:#fff; display:grid; place-items:center; font-size:16px; flex-shrink:0; box-shadow:0 4px 10px rgba(249,115,22,.1); }
  .psh2-row .ttl { font-size:11px; font-weight:800; color:#9CA3AF; letter-spacing:.5px; margin-bottom:3px; }
  .psh2-row .v { font-size:14px; font-weight:800; color:#0F1F5C; line-height:1.5; letter-spacing:-.3px; }
  @media (max-width:880px) { .psh2-grid { grid-template-columns:1fr; } .psh2-head h2 { font-size:24px; } }
  </style>
  <section class="psh2" id="location">
    <div class="psh2-inner">
      <div class="psh2-head">
        <div class="kicker">📍 LOCATION</div>
        <h2>쇼룸 위치·약도</h2>
      </div>
      <div class="psh2-grid">
        <div class="psh2-map">
          <div class="pin">📍</div>
          <div class="overlay">
            <div class="name">POUR스토어 쇼룸 · 평택 본사 1층</div>
            <div class="addr">경기도 평택시 ○○로 ○○ (○○동)</div>
          </div>
        </div>
        <div class="psh2-info">
          <div class="label">HOW TO COME</div>
          <h3>오시는 길 안내</h3>
          <div class="psh2-row"><div class="icon">🚗</div><div><div class="ttl">자가용</div><div class="v">평택 IC 진입 후 ○○로 직진<br/>현장 무료 주차장 30대 이용 가능</div></div></div>
          <div class="psh2-row"><div class="icon">🚆</div><div><div class="ttl">대중교통</div><div class="v">1호선 평택역 도보 12분<br/>또는 평택역에서 ○○번 버스 5분</div></div></div>
          <div class="psh2-row"><div class="icon">🛣️</div><div><div class="ttl">서울 출발</div><div class="v">경부고속도로 1시간 10분<br/>판교 출발 50분</div></div></div>
          <div class="psh2-row"><div class="icon">📞</div><div><div class="ttl">길 문의</div><div class="v">1577-0000 (평일 09-18시)</div></div></div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_SH_HOURS_HTML = `<style>
  .psh3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .psh3 { background:#FFFBF5; padding:64px 18px; }
  .psh3-inner { max-width:1100px; margin:0 auto; }
  .psh3-head { text-align:center; margin-bottom:32px; }
  .psh3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .psh3-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .psh3-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
  .psh3-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:24px 22px; text-align:center; transition:all .25s; }
  .psh3-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .psh3-card.closed { background:#F9FAFB; border-color:#E5E7EB; }
  .psh3-card.closed .day, .psh3-card.closed .hours { color:#9CA3AF; }
  .psh3-card .day { font-size:13px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:10px; }
  .psh3-card .hours { font-family:'Bebas Neue',sans-serif; font-size:24px; font-weight:900; color:#0F1F5C; letter-spacing:.5px; line-height:1.2; margin-bottom:6px; }
  .psh3-card .note { font-size:11.5px; color:#6B7280; font-weight:700; }
  .psh3-notice { margin-top:24px; padding:18px 22px; background:#fff; border:1px solid #FED7AA; border-radius:14px; }
  .psh3-notice .label { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .psh3-notice .text { font-size:13px; color:#4B5563; line-height:1.7; }
  .psh3-notice b { color:#0F1F5C; font-weight:800; }
  @media (max-width:640px) { .psh3-head h2 { font-size:22px; } }
  </style>
  <section class="psh3">
    <div class="psh3-inner">
      <div class="psh3-head">
        <div class="kicker">⏰ OPENING HOURS</div>
        <h2>쇼룸 운영 시간</h2>
      </div>
      <div class="psh3-grid">
        <div class="psh3-card"><div class="day">월-금 (평일)</div><div class="hours">09:00 - 18:00</div><div class="note">상시 운영 · 점심 12:30-13:30 휴무</div></div>
        <div class="psh3-card"><div class="day">토요일</div><div class="hours">10:00 - 16:00</div><div class="note">예약 방문만 운영 · 점심 무휴</div></div>
        <div class="psh3-card closed"><div class="day">일요일</div><div class="hours">CLOSED</div><div class="note">휴무</div></div>
        <div class="psh3-card closed"><div class="day">법정 공휴일</div><div class="hours">CLOSED</div><div class="note">전일 사전 안내</div></div>
      </div>
      <div class="psh3-notice">
        <div class="label">💡 방문 안내</div>
        <div class="text"><b>예약 방문이 우선 응대</b>됩니다. 워크인 방문도 가능하지만 상담사 일정에 따라 대기시간이 발생할 수 있어요. 여유로운 상담을 원하시면 본 페이지 하단 <b>방문 예약 폼</b>을 이용해 주세요.</div>
      </div>
    </div>
  </section>`;

  const SEED_SH_TOUR_HTML = `<style>
  .psh4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .psh4 { background:#fff; padding:80px 18px; }
  .psh4-inner { max-width:1200px; margin:0 auto; }
  .psh4-head { text-align:center; margin-bottom:36px; }
  .psh4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .psh4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .psh4-head p { font-size:14px; color:#6B7280; }
  .psh4-feature { aspect-ratio:21/9; background-image:url('https://placehold.co/1200x515/0F1F5C/fff?text=SHOWROOM+MAIN'); background-size:cover; background-position:center; border-radius:24px; position:relative; overflow:hidden; margin-bottom:14px; cursor:pointer; }
  .psh4-feature::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg, rgba(15,31,92,.85) 0%, rgba(15,31,92,.2) 50%, transparent 100%); }
  .psh4-feature .label { position:absolute; bottom:24px; left:24px; right:24px; color:#fff; z-index:1; }
  .psh4-feature .label .badge { display:inline-block; padding:5px 11px; background:#F97316; font-size:10.5px; font-weight:900; letter-spacing:.5px; border-radius:5px; margin-bottom:10px; }
  .psh4-feature .label .name { font-size:22px; font-weight:900; line-height:1.3; letter-spacing:-.5px; }
  .psh4-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; }
  .psh4-thumb { aspect-ratio:4/3; background-size:cover; background-position:center; border-radius:14px; position:relative; overflow:hidden; cursor:pointer; transition:transform .3s; }
  .psh4-thumb:hover { transform:translateY(-3px); }
  .psh4-thumb::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg, rgba(15,31,92,.7) 0%, transparent 60%); }
  .psh4-thumb .ttl { position:absolute; bottom:12px; left:14px; right:14px; color:#fff; font-size:13px; font-weight:800; z-index:1; letter-spacing:-.3px; }
  @media (max-width:640px) { .psh4-head h2 { font-size:24px; } .psh4-feature .label .name { font-size:16px; } }
  </style>
  <section class="psh4">
    <div class="psh4-inner">
      <div class="psh4-head">
        <div class="kicker">SHOWROOM TOUR</div>
        <h2>쇼룸 둘러보기</h2>
        <p>실제 시공된 모습을 그대로 재현 — 자재가 어떻게 보이고 만져지는지 직접 확인하세요</p>
      </div>
      <div class="psh4-feature">
        <div class="label">
          <span class="badge">⭐ MAIN HALL</span>
          <div class="name">110+ 제품이 전시된 메인 쇼룸</div>
        </div>
      </div>
      <div class="psh4-grid">
        <div class="psh4-thumb" style="background-image:url('https://placehold.co/400x300/F97316/fff?text=ROOFTOP')"><div class="ttl">옥상 시공 모형 존</div></div>
        <div class="psh4-thumb" style="background-image:url('https://placehold.co/400x300/EA580C/fff?text=WALL')"><div class="ttl">외벽 도장 색상 샘플</div></div>
        <div class="psh4-thumb" style="background-image:url('https://placehold.co/400x300/059669/fff?text=PARKING')"><div class="ttl">지하주차장 바닥 시공 비교</div></div>
        <div class="psh4-thumb" style="background-image:url('https://placehold.co/400x300/FB923C/fff?text=PRODUCT')"><div class="ttl">제품 라인업 진열</div></div>
        <div class="psh4-thumb" style="background-image:url('https://placehold.co/400x300/0F1F5C/fff?text=CONSULT')"><div class="ttl">1:1 상담 라운지</div></div>
        <div class="psh4-thumb" style="background-image:url('https://placehold.co/400x300/F97316/fff?text=LAB')"><div class="ttl">R&D 랩 투명 관람</div></div>
      </div>
    </div>
  </section>`;

  const SEED_SH_DISPLAY_HTML = `<style>
  .psh5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .psh5 { background:#FFFBF5; padding:80px 18px; }
  .psh5-inner { max-width:1200px; margin:0 auto; }
  .psh5-head { text-align:center; margin-bottom:36px; }
  .psh5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .psh5-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .psh5-head p { font-size:14px; color:#6B7280; }
  .psh5-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
  .psh5-card { background:#fff; border:1px solid #F3F4F6; border-radius:16px; overflow:hidden; transition:all .25s; }
  .psh5-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .psh5-thumb { aspect-ratio:1/1; background-size:cover; background-position:center; position:relative; }
  .psh5-thumb .badge { position:absolute; top:10px; left:10px; padding:4px 9px; background:rgba(249,115,22,.92); color:#fff; font-size:10px; font-weight:900; border-radius:5px; letter-spacing:.3px; }
  .psh5-info { padding:14px; }
  .psh5-info .cat { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:5px; }
  .psh5-info .name { font-size:13.5px; font-weight:800; color:#0F1F5C; margin-bottom:8px; line-height:1.4; letter-spacing:-.3px; }
  .psh5-info .points { font-size:11.5px; color:#6B7280; line-height:1.55; }
  @media (max-width:640px) { .psh5-head h2 { font-size:24px; } }
  </style>
  <section class="psh5">
    <div class="psh5-inner">
      <div class="psh5-head">
        <div class="kicker">FEATURED DISPLAYS</div>
        <h2>전시 제품 하이라이트</h2>
        <p>쇼룸에서 직접 만져볼 수 있는 핵심 자재 — 시공 후 표면 질감·색상·강도까지</p>
      </div>
      <div class="psh5-grid">
        <div class="psh5-card"><div class="psh5-thumb" style="background-image:url('https://placehold.co/400x400/F97316/fff?text=COAT')"><div class="badge">FEATURE</div></div><div class="psh5-info"><div class="cat">방수재</div><div class="name">POUR 코트재 (5kg/20kg)</div><div class="points">시공 전·후 단면 비교 · 색상 6종 샘플</div></div></div>
        <div class="psh5-card"><div class="psh5-thumb" style="background-image:url('https://placehold.co/400x400/EA580C/fff?text=SHEET')"></div><div class="psh5-info"><div class="cat">방수재 · 시트</div><div class="name">슈퍼복합압축시트</div><div class="points">니들펀칭 단면 · 인장 파괴 시연</div></div></div>
        <div class="psh5-card"><div class="psh5-thumb" style="background-image:url('https://placehold.co/400x400/0F1F5C/fff?text=HYPER+T')"></div><div class="psh5-info"><div class="cat">균열 보수</div><div class="name">POUR 하이퍼티 고탄성 퍼티</div><div class="points">600% 신율 시연 + 균열 보수 모형</div></div></div>
        <div class="psh5-card"><div class="psh5-thumb" style="background-image:url('https://placehold.co/400x400/059669/fff?text=POWDER')"></div><div class="psh5-info"><div class="cat">강도 시연</div><div class="name">탄성강화 파우더</div><div class="points">망치 타격 시연 · 단면 복구 모형</div></div></div>
        <div class="psh5-card"><div class="psh5-thumb" style="background-image:url('https://placehold.co/400x400/FB923C/fff?text=HOOKER')"></div><div class="psh5-info"><div class="cat">특허 부품</div><div class="name">POUR HOOKER (특허)</div><div class="points">후레싱 보강 시공 모형</div></div></div>
        <div class="psh5-card"><div class="psh5-thumb" style="background-image:url('https://placehold.co/400x400/F97316/fff?text=EPOXY')"></div><div class="psh5-info"><div class="cat">바닥 마감</div><div class="name">에폭시·엠보라이닝 도료</div><div class="points">실제 바닥 시공 — 미끄럼 시연</div></div></div>
        <div class="psh5-card"><div class="psh5-thumb" style="background-image:url('https://placehold.co/400x400/EA580C/fff?text=PAINT')"></div><div class="psh5-info"><div class="cat">외벽 도장</div><div class="name">바인더 · 플러스 색상 샘플</div><div class="points">28색 컬러 칩 · 시공 후 발색 비교</div></div></div>
        <div class="psh5-card"><div class="psh5-thumb" style="background-image:url('https://placehold.co/400x400/059669/fff?text=VENT')"></div><div class="psh5-info"><div class="cat">결로 방지</div><div class="name">페이퍼팬벤트 무동력 환기구</div><div class="points">실제 작동 모형 — 통풍 원리 체험</div></div></div>
      </div>
    </div>
  </section>`;

  const SEED_SH_BOOK_HTML = `<style>
  .psh6 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .psh6 { background:#fff; padding:80px 18px; }
  .psh6-inner { max-width:980px; margin:0 auto; }
  .psh6-head { text-align:center; margin-bottom:32px; }
  .psh6-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .psh6-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .psh6-head p { font-size:14px; color:#6B7280; }
  .psh6-card { background:#fff; border:1px solid #F3F4F6; border-radius:24px; padding:36px 32px; box-shadow:0 12px 36px rgba(15,31,92,.06); }
  .psh6-section { margin-bottom:24px; }
  .psh6-section .stitle { font-size:13px; font-weight:900; color:#0F1F5C; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid #FFEDD5; letter-spacing:-.3px; }
  .psh6-row { margin-bottom:14px; }
  .psh6-row.split { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .psh6-row label { display:block; font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .psh6-row input, .psh6-row select, .psh6-row textarea { width:100%; padding:12px 14px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:10px; font-size:14px; font-family:inherit; color:#0F1F5C; transition:all .2s; }
  .psh6-row textarea { min-height:80px; resize:vertical; }
  .psh6-row input:focus, .psh6-row select:focus, .psh6-row textarea:focus { outline:none; border-color:#FED7AA; background:#fff; box-shadow:0 0 0 3px rgba(249,115,22,.08); }
  .psh6-purpose { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px; }
  .psh6-purpose-item { padding:14px 12px; background:#FFFBF5; border:1.5px solid #F3F4F6; border-radius:10px; text-align:center; cursor:pointer; transition:all .2s; }
  .psh6-purpose-item:hover { border-color:#FED7AA; }
  .psh6-purpose-item.active { background:#FFF7ED; border-color:#F97316; }
  .psh6-purpose-item .icon { font-size:22px; margin-bottom:4px; }
  .psh6-purpose-item .label { font-size:12px; font-weight:800; color:#0F1F5C; letter-spacing:-.3px; }
  .psh6-purpose-item.active .label { color:#EA580C; }
  .psh6-agree { display:flex; align-items:center; gap:8px; margin-bottom:18px; padding:14px; background:#FFFBF5; border-radius:10px; font-size:12.5px; color:#4B5563; }
  .psh6-agree input { width:16px; height:16px; accent-color:#F97316; }
  .psh6-submit { width:100%; padding:16px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:14px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(249,115,22,.3); transition:all .25s; }
  .psh6-submit:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,.45); }
  @media (max-width:640px) { .psh6-card { padding:24px 18px; } .psh6-row.split { grid-template-columns:1fr; } .psh6-head h2 { font-size:24px; } }
  </style>
  <section class="psh6" id="booking-form">
    <div class="psh6-inner">
      <div class="psh6-head">
        <div class="kicker">VISIT BOOKING</div>
        <h2>쇼룸 방문 예약</h2>
        <p>예약자 우선 응대 — 충분한 상담 시간 확보를 위해 사전 예약을 권장드립니다</p>
      </div>
      <form class="psh6-card">
        <div class="psh6-section">
          <div class="stitle">📅 1. 방문 일정</div>
          <div class="psh6-row split">
            <div><label>희망 날짜</label><input type="date"/></div>
            <div><label>희망 시간</label><select><option>10:00</option><option>11:00</option><option>14:00</option><option>15:00</option><option>16:00</option><option>17:00</option></select></div>
          </div>
        </div>
        <div class="psh6-section">
          <div class="stitle">🎯 2. 방문 목적 (복수 선택)</div>
          <div class="psh6-purpose">
            <div class="psh6-purpose-item active"><div class="icon">🔍</div><div class="label">제품 체험</div></div>
            <div class="psh6-purpose-item"><div class="icon">💬</div><div class="label">시공 상담</div></div>
            <div class="psh6-purpose-item"><div class="icon">💰</div><div class="label">견적 문의</div></div>
            <div class="psh6-purpose-item"><div class="icon">🤝</div><div class="label">파트너 미팅</div></div>
            <div class="psh6-purpose-item"><div class="icon">🎓</div><div class="label">교육 참관</div></div>
            <div class="psh6-purpose-item"><div class="icon">📋</div><div class="label">기타</div></div>
          </div>
        </div>
        <div class="psh6-section">
          <div class="stitle">👥 3. 방문 정보</div>
          <div class="psh6-row split">
            <div><label>성함</label><input type="text" placeholder="홍길동"/></div>
            <div><label>방문 인원</label><select><option>1명</option><option>2-3명</option><option>4-6명</option><option>7명 이상</option></select></div>
          </div>
          <div class="psh6-row split">
            <div><label>연락처</label><input type="text" placeholder="010-0000-0000"/></div>
            <div><label>소속 (선택)</label><input type="text" placeholder="○○관리사무소"/></div>
          </div>
          <div class="psh6-row"><label>관심 자재·시공 (선택)</label><textarea placeholder="미리 알려주시면 해당 자재·사례를 준비해 드립니다"></textarea></div>
        </div>
        <div class="psh6-agree"><input type="checkbox" id="ag5"/><label for="ag5">개인정보 수집·이용에 동의합니다</label></div>
        <button type="submit" class="psh6-submit">방문 예약 신청</button>
      </form>
    </div>
  </section>`;

  const SEED_SH_DIRECT_HTML = `<style>
  .psh7 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .psh7 { background:#FFFBF5; padding:64px 18px; }
  .psh7-inner { max-width:1100px; margin:0 auto; }
  .psh7-head { text-align:center; margin-bottom:32px; }
  .psh7-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .psh7-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .psh7-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; }
  .psh7-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:24px 22px; transition:all .25s; }
  .psh7-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .psh7-card .icon { width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:24px; margin-bottom:14px; }
  .psh7-card .name { font-size:15px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .psh7-card .desc { font-size:12.5px; color:#6B7280; line-height:1.65; margin-bottom:12px; min-height:38px; }
  .psh7-card .v { font-size:13.5px; font-weight:800; color:#EA580C; letter-spacing:-.3px; }
  @media (max-width:640px) { .psh7-head h2 { font-size:22px; } }
  </style>
  <section class="psh7">
    <div class="psh7-inner">
      <div class="psh7-head">
        <div class="kicker">DETAILED DIRECTIONS</div>
        <h2>찾아오시는 길 상세</h2>
      </div>
      <div class="psh7-grid">
        <div class="psh7-card"><div class="icon">🚗</div><div class="name">자가용 이용</div><div class="desc">평택 IC → ○○로 직진 5분 — 본사 무료 주차장 30대 보유</div><div class="v">서울 1시간 10분 / 부산 4시간</div></div>
        <div class="psh7-card"><div class="icon">🚆</div><div class="name">기차·KTX</div><div class="desc">1호선·KTX 평택역 → ○○번 버스 5분 또는 도보 12분</div><div class="v">평택역 도보 12분</div></div>
        <div class="psh7-card"><div class="icon">🚌</div><div class="name">시외버스</div><div class="desc">평택 시외버스터미널 → 택시 8분 / 시내버스 ○○번</div><div class="v">택시 8분</div></div>
        <div class="psh7-card"><div class="icon">🛬</div><div class="name">인천공항에서</div><div class="desc">공항버스 6300번 평택역 직행 → 도보·택시</div><div class="v">버스 1시간 30분</div></div>
        <div class="psh7-card"><div class="icon">🅿️</div><div class="name">주차 정보</div><div class="desc">본사 부지 내 무료 주차장 30대 — 대형차·대중교통 단체 별도 협의</div><div class="v">상시 30대 무료</div></div>
        <div class="psh7-card"><div class="icon">📞</div><div class="name">길 안내 문의</div><div class="desc">방문 당일 길 헷갈리시면 언제든 전화주세요. 평일 09-18시 응대</div><div class="v">1577-0000</div></div>
      </div>
    </div>
  </section>`;


  const SEED_MG_HERO_HTML = `<style>
  .pmg1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmg1 { background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 100%); padding:80px 18px 56px; position:relative; overflow:hidden; }
  .pmg1::before { content:''; position:absolute; top:-100px; right:-80px; width:380px; height:380px; background:radial-gradient(circle, rgba(249,115,22,.12) 0%, transparent 60%); border-radius:50%; }
  .pmg1-inner { max-width:1100px; margin:0 auto; text-align:center; position:relative; z-index:1; }
  .pmg1-tag { display:inline-flex; gap:6px; padding:6px 14px; background:#fff; border:1px solid #FED7AA; color:#EA580C; border-radius:999px; font-size:11.5px; font-weight:800; letter-spacing:.8px; margin-bottom:18px; box-shadow:0 4px 12px rgba(249,115,22,.1); }
  .pmg1 h1 { font-size:44px; font-weight:900; color:#0F1F5C; line-height:1.2; margin-bottom:16px; letter-spacing:-1.4px; }
  .pmg1 h1 .accent { color:#F97316; }
  .pmg1-desc { font-size:15.5px; color:#4B5563; line-height:1.75; max-width:600px; margin:0 auto 32px; }
  .pmg1-search { max-width:600px; margin:0 auto; position:relative; }
  .pmg1-search input { width:100%; padding:18px 24px 18px 56px; background:#fff; border:1px solid #F3F4F6; border-radius:18px; font-size:15px; font-family:inherit; color:#0F1F5C; transition:all .2s; box-shadow:0 8px 24px rgba(15,31,92,.08); }
  .pmg1-search input:focus { outline:none; border-color:#FED7AA; box-shadow:0 8px 24px rgba(249,115,22,.18); }
  .pmg1-search .icon { position:absolute; top:50%; left:22px; transform:translateY(-50%); font-size:20px; }
  .pmg1-tags { display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-top:18px; }
  .pmg1-tags .tag { padding:6px 14px; background:rgba(255,255,255,.8); border:1px solid #FED7AA; color:#EA580C; font-size:12px; font-weight:800; border-radius:999px; cursor:pointer; transition:all .2s; }
  .pmg1-tags .tag:hover { background:#fff; }
  @media (max-width:640px) { .pmg1 h1 { font-size:28px; } }
  </style>
  <section class="pmg1">
    <div class="pmg1-inner">
      <span class="pmg1-tag">📖 STORE MAGAZINE</span>
      <h1>시공·자재·트렌드<br/><span class="accent">콘텐츠 허브</span></h1>
      <p class="pmg1-desc">시공 설명서·영상 가이드·케이스 스터디·트렌드 — POUR가 직접 만드는 모든 콘텐츠를 한곳에서.</p>
      <div class="pmg1-search">
        <span class="icon">🔍</span>
        <input type="text" placeholder="키워드로 검색해 보세요 — 예: 옥상 누수, 외벽 도장, 셀프시공"/>
      </div>
      <div class="pmg1-tags">
        <span class="tag">#옥상누수</span>
        <span class="tag">#외벽도장</span>
        <span class="tag">#균열보수</span>
        <span class="tag">#셀프시공</span>
        <span class="tag">#하이퍼티</span>
        <span class="tag">#아파트관리</span>
      </div>
    </div>
  </section>`;

  const SEED_MG_TABS_HTML = `<style>
  .pmg2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmg2 { background:#fff; padding:32px 18px; border-bottom:1px solid #F3F4F6; }
  .pmg2-inner { max-width:1200px; margin:0 auto; }
  .pmg2-tabs { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
  .pmg2-tab { padding:11px 22px; background:#fff; border:1.5px solid #F3F4F6; border-radius:999px; font-size:13.5px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; display:inline-flex; align-items:center; gap:7px; }
  .pmg2-tab:hover { border-color:#FED7AA; color:#EA580C; }
  .pmg2-tab.active { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-color:transparent; box-shadow:0 6px 16px rgba(249,115,22,.3); }
  .pmg2-tab .icon { font-size:15px; }
  .pmg2-tab .count { font-size:11px; padding:2px 7px; background:#FFF7ED; color:#EA580C; border-radius:6px; font-weight:800; }
  .pmg2-tab.active .count { background:rgba(255,255,255,.25); color:#fff; }
  @media (max-width:640px) { .pmg2-tabs { gap:6px; } .pmg2-tab { padding:9px 14px; font-size:12.5px; } }
  </style>
  <section class="pmg2">
    <div class="pmg2-inner">
      <div class="pmg2-tabs">
        <button class="pmg2-tab active"><span class="icon">📌</span>전체<span class="count">328</span></button>
        <button class="pmg2-tab"><span class="icon">🔧</span>시공방법<span class="count">86</span></button>
        <button class="pmg2-tab"><span class="icon">📊</span>케이스 스터디<span class="count">62</span></button>
        <button class="pmg2-tab"><span class="icon">📦</span>제품 가이드<span class="count">48</span></button>
        <button class="pmg2-tab"><span class="icon">▶</span>영상 가이드<span class="count">72</span></button>
        <button class="pmg2-tab"><span class="icon">📈</span>트렌드</button>
        <button class="pmg2-tab"><span class="icon">🛠️</span>셀프시공</button>
      </div>
    </div>
  </section>`;

  const SEED_MG_PICK_HTML = `<style>
  .pmg3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmg3 { background:#fff; padding:64px 18px; }
  .pmg3-inner { max-width:1200px; margin:0 auto; }
  .pmg3-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
  .pmg3-head .left .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:6px; }
  .pmg3-head .left h2 { font-size:28px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pmg3-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; background:#fff; }
  .pmg3-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:18px; }
  .pmg3-feature { position:relative; aspect-ratio:16/11; border-radius:20px; overflow:hidden; background-size:cover; background-position:center; cursor:pointer; transition:transform .3s; }
  .pmg3-feature:hover { transform:translateY(-3px); }
  .pmg3-feature::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg, rgba(15,31,92,.92) 0%, rgba(15,31,92,.3) 50%, transparent 100%); }
  .pmg3-feature .info { position:absolute; bottom:24px; left:24px; right:24px; color:#fff; z-index:1; }
  .pmg3-feature .badge { display:inline-block; padding:4px 11px; background:#F97316; font-size:10.5px; font-weight:900; letter-spacing:.5px; border-radius:5px; margin-bottom:12px; }
  .pmg3-feature .title { font-size:24px; font-weight:900; line-height:1.3; margin-bottom:8px; letter-spacing:-.5px; }
  .pmg3-feature .meta { font-size:12.5px; opacity:.9; font-weight:700; }
  .pmg3-list { display:flex; flex-direction:column; gap:12px; }
  .pmg3-mini { display:grid; grid-template-columns:120px 1fr; gap:14px; padding:14px; background:#FFFBF5; border:1px solid #F3F4F6; border-radius:14px; transition:all .25s; cursor:pointer; }
  .pmg3-mini:hover { transform:translateX(3px); background:#fff; box-shadow:0 8px 20px rgba(15,31,92,.06); border-color:#FED7AA; }
  .pmg3-mini .thumb { aspect-ratio:1/1; border-radius:10px; background-size:cover; background-position:center; }
  .pmg3-mini .text { display:flex; flex-direction:column; justify-content:center; min-width:0; }
  .pmg3-mini .cat { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:4px; }
  .pmg3-mini .title { font-size:13.5px; font-weight:800; color:#0F1F5C; line-height:1.4; margin-bottom:6px; letter-spacing:-.3px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .pmg3-mini .meta { font-size:11px; color:#9CA3AF; font-weight:700; }
  @media (max-width:880px) { .pmg3-grid { grid-template-columns:1fr; } .pmg3-feature .title { font-size:18px; } }
  </style>
  <section class="pmg3">
    <div class="pmg3-inner">
      <div class="pmg3-head">
        <div class="left">
          <div class="kicker">⭐ EDITOR'S PICK</div>
          <h2>에디터가 추천하는 콘텐츠</h2>
        </div>
        <a class="more" href="#">전체 보기 →</a>
      </div>
      <div class="pmg3-grid">
        <div class="pmg3-feature" style="background-image:url('https://placehold.co/800x550/0F1F5C/fff?text=COVER+STORY')">
          <div class="info">
            <span class="badge">COVER STORY</span>
            <div class="title">2026년 봄, 옥상 누수 안 잡는 5가지 실수</div>
            <div class="meta">시공방법 · 8분 읽기 · 조회 12K · 4월 28일</div>
          </div>
        </div>
        <div class="pmg3-list">
          <div class="pmg3-mini"><div class="thumb" style="background-image:url('https://placehold.co/200x200/F97316/fff?text=GUIDE1')"></div><div class="text"><div class="cat">제품 가이드</div><div class="title">POUR 코트재 vs 우레탄 — 어느 게 맞을까?</div><div class="meta">5분 읽기 · 조회 8.2K</div></div></div>
          <div class="pmg3-mini"><div class="thumb" style="background-image:url('https://placehold.co/200x200/EA580C/fff?text=CASE')"></div><div class="text"><div class="cat">케이스 스터디</div><div class="title">강남 래미안 옥상 시공 풀스토리 — 6개월 추적</div><div class="meta">12분 읽기 · 조회 6.5K</div></div></div>
          <div class="pmg3-mini"><div class="thumb" style="background-image:url('https://placehold.co/200x200/059669/fff?text=DIY')"></div><div class="text"><div class="cat">셀프시공</div><div class="title">베란다 누수 — 주말에 혼자 잡는 방법</div><div class="meta">7분 읽기 · 조회 9.8K</div></div></div>
          <div class="pmg3-mini"><div class="thumb" style="background-image:url('https://placehold.co/200x200/FB923C/fff?text=TREND')"></div><div class="text"><div class="cat">트렌드</div><div class="title">2026 외벽 도장 컬러 트렌드 — 차분한 누드톤</div><div class="meta">4분 읽기 · 조회 5.4K</div></div></div>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_MG_VIDEO_HTML = `<style>
  .pmg4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmg4 { background:#FFFBF5; padding:64px 18px; }
  .pmg4-inner { max-width:1200px; margin:0 auto; }
  .pmg4-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
  .pmg4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:6px; }
  .pmg4-head h2 { font-size:28px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pmg4-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; background:#fff; }
  .pmg4-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
  .pmg4-card { background:#fff; border:1px solid #F3F4F6; border-radius:16px; overflow:hidden; transition:all .3s; cursor:pointer; }
  .pmg4-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.1); border-color:#FED7AA; }
  .pmg4-thumb { aspect-ratio:16/10; background-size:cover; background-position:center; position:relative; }
  .pmg4-thumb::before { content:''; position:absolute; inset:0; background:linear-gradient(0deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.1) 50%, transparent 100%); transition:opacity .25s; opacity:.5; }
  .pmg4-card:hover .pmg4-thumb::before { opacity:.7; }
  .pmg4-thumb .play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:52px; height:52px; border-radius:50%; background:rgba(255,255,255,.95); display:grid; place-items:center; transition:transform .3s; }
  .pmg4-card:hover .pmg4-thumb .play { transform:translate(-50%,-50%) scale(1.12); }
  .pmg4-thumb .play svg { width:20px; height:20px; fill:#EA580C; margin-left:3px; }
  .pmg4-thumb .dur { position:absolute; bottom:8px; right:8px; padding:3px 8px; background:rgba(0,0,0,.78); color:#fff; font-size:10.5px; font-weight:800; border-radius:5px; letter-spacing:.3px; }
  .pmg4-thumb .rank { position:absolute; top:8px; left:8px; padding:4px 9px; background:rgba(249,115,22,.92); color:#fff; font-size:10.5px; font-weight:900; border-radius:5px; }
  .pmg4-info { padding:14px; }
  .pmg4-info .cat { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.3px; margin-bottom:6px; }
  .pmg4-info .title { font-size:13.5px; font-weight:800; color:#0F1F5C; line-height:1.4; margin-bottom:8px; letter-spacing:-.3px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:38px; }
  .pmg4-info .meta { font-size:11px; color:#9CA3AF; font-weight:700; }
  @media (max-width:640px) { .pmg4-head h2 { font-size:22px; } }
  </style>
  <section class="pmg4">
    <div class="pmg4-inner">
      <div class="pmg4-head">
        <div>
          <div class="kicker">▶ TRENDING VIDEOS</div>
          <h2>이번 주 인기 시공 영상</h2>
        </div>
        <a class="more" href="https://www.pourstore.net/videos">전체 영상 →</a>
      </div>
      <div class="pmg4-grid">
        <div class="pmg4-card"><div class="pmg4-thumb" style="background-image:url('https://placehold.co/400x250/0F1F5C/fff?text=ROOFTOP')"><div class="rank">#1</div><div class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div><div class="dur">14:28</div></div><div class="pmg4-info"><div class="cat">옥상 시공</div><div class="title">POUR 코트재 — 옥상 슬라브 시공 풀가이드</div><div class="meta">조회 28K · 3일 전</div></div></div>
        <div class="pmg4-card"><div class="pmg4-thumb" style="background-image:url('https://placehold.co/400x250/F97316/fff?text=DIY')"><div class="rank">#2</div><div class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div><div class="dur">8:42</div></div><div class="pmg4-info"><div class="cat">셀프시공</div><div class="title">베란다 누수 — 혼자서 잡는 5단계</div><div class="meta">조회 22K · 5일 전</div></div></div>
        <div class="pmg4-card"><div class="pmg4-thumb" style="background-image:url('https://placehold.co/400x250/EA580C/fff?text=CRACK')"><div class="rank">#3</div><div class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div><div class="dur">11:15</div></div><div class="pmg4-info"><div class="cat">균열 보수</div><div class="title">하이퍼티로 외벽 균열 보수 — 5분 정리</div><div class="meta">조회 18K · 1주 전</div></div></div>
        <div class="pmg4-card"><div class="pmg4-thumb" style="background-image:url('https://placehold.co/400x250/059669/fff?text=COMPARE')"><div class="rank">#4</div><div class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div><div class="dur">7:32</div></div><div class="pmg4-info"><div class="cat">제품 비교</div><div class="title">우레탄 vs PVC vs 코트재 — 뭐가 달라요?</div><div class="meta">조회 14K · 2주 전</div></div></div>
      </div>
    </div>
  </section>`;

  const SEED_MG_GUIDE_HTML = `<style>
  .pmg5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmg5 { background:#fff; padding:64px 18px; }
  .pmg5-inner { max-width:1200px; margin:0 auto; }
  .pmg5-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
  .pmg5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:6px; }
  .pmg5-head h2 { font-size:28px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pmg5-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; background:#fff; }
  .pmg5-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; }
  .pmg5-card { background:#fff; border:1px solid #F3F4F6; border-radius:16px; padding:24px 22px; transition:all .25s; }
  .pmg5-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .pmg5-card .icon { width:44px; height:44px; border-radius:11px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:22px; margin-bottom:14px; }
  .pmg5-card .name { font-size:15px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .pmg5-card .desc { font-size:12.5px; color:#6B7280; line-height:1.6; margin-bottom:12px; min-height:38px; }
  .pmg5-card .meta { display:flex; align-items:center; gap:8px; padding-top:12px; border-top:1px solid #F3F4F6; font-size:11px; color:#9CA3AF; font-weight:700; }
  .pmg5-card .meta .dot { width:3px; height:3px; border-radius:50%; background:#D1D5DB; }
  .pmg5-card .pdf { display:inline-block; padding:3px 8px; background:#FEE2E2; color:#DC2626; font-size:10px; font-weight:800; border-radius:4px; }
  @media (max-width:640px) { .pmg5-head h2 { font-size:22px; } }
  </style>
  <section class="pmg5">
    <div class="pmg5-inner">
      <div class="pmg5-head">
        <div>
          <div class="kicker">📋 SPEC SHEETS</div>
          <h2>시공 설명서 모음</h2>
        </div>
        <a class="more" href="https://www.pourstore.net/spec">전체 시방서 →</a>
      </div>
      <div class="pmg5-grid">
        <div class="pmg5-card"><div class="icon">💧</div><div class="name">슬라브 듀얼강화방수 시방서</div><div class="desc">옥상 슬라브 누수 + 콘크리트 중성화 — 6가지 핵심 방안 일체 시공</div><div class="meta"><span class="pdf">PDF</span><span>2.4 MB</span><span class="dot"></span><span>다운로드 1,245</span></div></div>
        <div class="pmg5-card"><div class="icon">🏠</div><div class="name">아스팔트슁글 방수 시방서</div><div class="desc">건설신기술 1026호 — 박공지붕 누수·강풍 탈락 동시 해결</div><div class="meta"><span class="pdf">PDF</span><span>1.8 MB</span><span class="dot"></span><span>다운로드 982</span></div></div>
        <div class="pmg5-card"><div class="icon">🎨</div><div class="name">외벽 균열보수·재도장 시방서</div><div class="desc">고급(바인더+플러스)/중급/경제형 — 예산별 선택 가능</div><div class="meta"><span class="pdf">PDF</span><span>3.1 MB</span><span class="dot"></span><span>다운로드 1,438</span></div></div>
        <div class="pmg5-card"><div class="icon">🚗</div><div class="name">에폭시·엠보라이닝 시방서</div><div class="desc">지하주차장 바닥 — MMA 논슬립(83 BPN) 포함</div><div class="meta"><span class="pdf">PDF</span><span>2.7 MB</span><span class="dot"></span><span>다운로드 765</span></div></div>
        <div class="pmg5-card"><div class="icon">🌊</div><div class="name">아크릴 배면차수 시방서</div><div class="desc">지하·수조 누수 — 초고압 주입 새 방수층 형성</div><div class="meta"><span class="pdf">PDF</span><span>1.5 MB</span><span class="dot"></span><span>다운로드 532</span></div></div>
        <div class="pmg5-card"><div class="icon">🛣️</div><div class="name">아스콘 도로포장 시방서</div><div class="desc">POUR아스콘 — 포트홀·균열 보수 + 씰코팅</div><div class="meta"><span class="pdf">PDF</span><span>2.0 MB</span><span class="dot"></span><span>다운로드 412</span></div></div>
      </div>
    </div>
  </section>`;

  const SEED_MG_POSTING_HTML = `<style>
  .pmg6 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmg6 { background:#FFFBF5; padding:80px 18px; }
  .pmg6-inner { max-width:1200px; margin:0 auto; }
  .pmg6-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:12px; }
  .pmg6-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:6px; }
  .pmg6-head h2 { font-size:28px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .pmg6-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; background:#fff; }
  .pmg6-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; }
  .pmg6-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; overflow:hidden; transition:all .3s; cursor:pointer; }
  .pmg6-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.1); border-color:#FED7AA; }
  .pmg6-thumb { aspect-ratio:5/4; background-size:cover; background-position:center; }
  .pmg6-info { padding:18px; }
  .pmg6-info .cat { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:8px; }
  .pmg6-info .title { font-size:15.5px; font-weight:900; color:#0F1F5C; margin-bottom:8px; line-height:1.4; letter-spacing:-.3px; }
  .pmg6-info .desc { font-size:12.5px; color:#6B7280; line-height:1.65; margin-bottom:14px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:40px; }
  .pmg6-info .author { display:flex; align-items:center; gap:10px; padding-top:14px; border-top:1px solid #F3F4F6; }
  .pmg6-info .avatar { width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:12px; font-weight:900; color:#EA580C; }
  .pmg6-info .author-info .name { font-size:11.5px; font-weight:800; color:#0F1F5C; }
  .pmg6-info .author-info .meta { font-size:10.5px; color:#9CA3AF; font-weight:700; margin-top:1px; }
  @media (max-width:640px) { .pmg6-head h2 { font-size:22px; } }
  </style>
  <section class="pmg6">
    <div class="pmg6-inner">
      <div class="pmg6-head">
        <div>
          <div class="kicker">✏️ STORE POSTING</div>
          <h2>자사몰 포스팅 — 오늘의집 스타일</h2>
        </div>
        <a class="more" href="#">전체 포스팅 →</a>
      </div>
      <div class="pmg6-grid">
        <div class="pmg6-card"><div class="pmg6-thumb" style="background-image:url('https://placehold.co/500x400/F97316/fff?text=POST1')"></div><div class="pmg6-info"><div class="cat">시공방법 · 옥상</div><div class="title">10년된 아파트 옥상, 한 번에 깨끗하게</div><div class="desc">매년 누수로 골치였던 분들 보세요. 코트재 한 통이면 끝나는 옥상 방수 노하우 전체 공개합니다.</div><div class="author"><div class="avatar">박</div><div class="author-info"><div class="name">에디터 박○○</div><div class="meta">5분 읽기 · 좋아요 248</div></div></div></div></div>
        <div class="pmg6-card"><div class="pmg6-thumb" style="background-image:url('https://placehold.co/500x400/EA580C/fff?text=POST2')"></div><div class="pmg6-info"><div class="cat">셀프시공 · 베란다</div><div class="title">베란다 곰팡이 — 주말에 끝내는 셀프 솔루션</div><div class="desc">매년 봄·가을 곰팡이로 스트레스라면 — 5만원으로 끝내는 셀프 시공 가이드.</div><div class="author"><div class="avatar">김</div><div class="author-info"><div class="name">에디터 김○○</div><div class="meta">7분 읽기 · 좋아요 192</div></div></div></div></div>
        <div class="pmg6-card"><div class="pmg6-thumb" style="background-image:url('https://placehold.co/500x400/0F1F5C/fff?text=POST3')"></div><div class="pmg6-info"><div class="cat">제품 비교</div><div class="title">방수재 비교 — 우레탄 vs PVC vs 코트재</div><div class="desc">"어떤 걸 사야 하지?" 망설이는 분들을 위한 — 상황별 추천 자재 정리.</div><div class="author"><div class="avatar">이</div><div class="author-info"><div class="name">에디터 이○○</div><div class="meta">8분 읽기 · 좋아요 156</div></div></div></div></div>
        <div class="pmg6-card"><div class="pmg6-thumb" style="background-image:url('https://placehold.co/500x400/059669/fff?text=POST4')"></div><div class="pmg6-info"><div class="cat">트렌드 · 외벽</div><div class="title">2026 외벽 컬러 트렌드 — 차분한 누드톤</div><div class="desc">올해 인기 외벽 컬러 6선. 입주민 만족도 높은 단지들이 선택한 색상은?</div><div class="author"><div class="avatar">최</div><div class="author-info"><div class="name">에디터 최○○</div><div class="meta">4분 읽기 · 좋아요 134</div></div></div></div></div>
        <div class="pmg6-card"><div class="pmg6-thumb" style="background-image:url('https://placehold.co/500x400/FB923C/fff?text=POST5')"></div><div class="pmg6-info"><div class="cat">케이스 스터디</div><div class="title">강남 래미안 옥상 — 6개월 추적기</div><div class="desc">시공 직후부터 6개월 후까지 — 실제 단지에서 어떤 변화가 있었는지 기록.</div><div class="author"><div class="avatar">정</div><div class="author-info"><div class="name">에디터 정○○</div><div class="meta">12분 읽기 · 좋아요 287</div></div></div></div></div>
        <div class="pmg6-card"><div class="pmg6-thumb" style="background-image:url('https://placehold.co/500x400/F97316/fff?text=POST6')"></div><div class="pmg6-info"><div class="cat">관리자 노하우</div><div class="title">관리소장이 알려주는 — 장기수선충당금 활용법</div><div class="desc">방수·도장 공사 시 충당금을 효율적으로 쓰는 5가지 노하우.</div><div class="author"><div class="avatar">조</div><div class="author-info"><div class="name">에디터 조○○</div><div class="meta">9분 읽기 · 좋아요 218</div></div></div></div></div>
      </div>
    </div>
  </section>`;

  const SEED_MG_RELATED_HTML = `<style>
  .pmg7 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmg7 { background:#fff; padding:64px 18px; }
  .pmg7-inner { max-width:1200px; margin:0 auto; }
  .pmg7-head { text-align:center; margin-bottom:32px; }
  .pmg7-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pmg7-head h2 { font-size:28px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .pmg7-head p { font-size:14px; color:#6B7280; }
  .pmg7-banner { background:linear-gradient(135deg,#FFF7ED,#FFEDD5); border:1px solid #FED7AA; border-radius:20px; padding:24px 28px; margin-bottom:24px; display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  .pmg7-banner .icon { width:48px; height:48px; border-radius:12px; background:#fff; display:grid; place-items:center; font-size:24px; flex-shrink:0; box-shadow:0 4px 12px rgba(249,115,22,.15); }
  .pmg7-banner .text { flex:1; min-width:200px; }
  .pmg7-banner .title { font-size:14.5px; font-weight:900; color:#0F1F5C; margin-bottom:3px; letter-spacing:-.3px; }
  .pmg7-banner .desc { font-size:12.5px; color:#6B7280; line-height:1.55; }
  .pmg7-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; }
  .pmg7-product { background:#fff; border:1px solid #F3F4F6; border-radius:14px; overflow:hidden; transition:all .25s; cursor:pointer; }
  .pmg7-product:hover { transform:translateY(-3px); box-shadow:0 14px 32px rgba(15,31,92,.08); border-color:#FED7AA; }
  .pmg7-product .thumb { aspect-ratio:1/1; background-size:cover; background-position:center; }
  .pmg7-product .info { padding:12px; }
  .pmg7-product .name { font-size:13px; font-weight:800; color:#0F1F5C; margin-bottom:6px; line-height:1.4; letter-spacing:-.3px; }
  .pmg7-product .price { display:flex; align-items:center; gap:6px; }
  .pmg7-product .now { font-size:14px; font-weight:900; color:#0F1F5C; }
  .pmg7-product .sale { font-size:11px; font-weight:800; color:#DC2626; }
  @media (max-width:640px) { .pmg7-head h2 { font-size:22px; } }
  </style>
  <section class="pmg7">
    <div class="pmg7-inner">
      <div class="pmg7-head">
        <div class="kicker">RELATED PRODUCTS</div>
        <h2>이 콘텐츠와 관련된 상품</h2>
        <p>읽으신 콘텐츠에서 다룬 자재를 바로 구매할 수 있어요</p>
      </div>
      <div class="pmg7-banner">
        <div class="icon">📖</div>
        <div class="text">
          <div class="title">"10년된 아파트 옥상, 한 번에 깨끗하게" 콘텐츠 관련</div>
          <div class="desc">옥상 슬라브 방수에 사용된 핵심 자재 4종을 묶었습니다</div>
        </div>
      </div>
      <div class="pmg7-grid">
        <div class="pmg7-product"><div class="thumb" style="background-image:url('https://placehold.co/300x300/F97316/fff?text=COAT')"></div><div class="info"><div class="name">POUR 코트재 5kg</div><div class="price"><span class="sale">15%</span><span class="now">68,000원</span></div></div></div>
        <div class="pmg7-product"><div class="thumb" style="background-image:url('https://placehold.co/300x300/EA580C/fff?text=SHEET')"></div><div class="info"><div class="name">슈퍼복합압축시트</div><div class="price"><span class="sale">8%</span><span class="now">128,000원</span></div></div></div>
        <div class="pmg7-product"><div class="thumb" style="background-image:url('https://placehold.co/300x300/0F1F5C/fff?text=VENT')"></div><div class="info"><div class="name">페이퍼팬벤트</div><div class="price"><span class="now">38,000원</span></div></div></div>
        <div class="pmg7-product"><div class="thumb" style="background-image:url('https://placehold.co/300x300/059669/fff?text=TRAP')"></div><div class="info"><div class="name">옥상배관 방수트랩</div><div class="price"><span class="now">56,000원</span></div></div></div>
        <div class="pmg7-product"><div class="thumb" style="background-image:url('https://placehold.co/300x300/FB923C/fff?text=PACKAGE')"></div><div class="info"><div class="name">옥상 풀세트 패키지</div><div class="price"><span class="sale">22%</span><span class="now">240,000원</span></div></div></div>
      </div>
    </div>
  </section>`;

  const SEED_MG_MORE_HTML = `<style>
  .pmg8 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .pmg8 { background:#FFFBF5; padding:80px 18px; }
  .pmg8-inner { max-width:1100px; margin:0 auto; }
  .pmg8-head { text-align:center; margin-bottom:36px; }
  .pmg8-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .pmg8-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
  .pmg8-head p { font-size:14px; color:#6B7280; }
  .pmg8-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
  .pmg8-card { background:#fff; border:1px solid #F3F4F6; border-radius:18px; padding:24px 22px; transition:all .25s; cursor:pointer; text-decoration:none; display:block; }
  .pmg8-card:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(15,31,92,.1); border-color:#FED7AA; }
  .pmg8-card .icon { width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:24px; margin-bottom:14px; transition:transform .3s; }
  .pmg8-card:hover .icon { transform:rotate(-8deg) scale(1.05); }
  .pmg8-card .name { font-size:15px; font-weight:900; color:#0F1F5C; margin-bottom:6px; letter-spacing:-.3px; }
  .pmg8-card .count { font-size:11.5px; font-weight:800; color:#EA580C; margin-bottom:10px; letter-spacing:.3px; }
  .pmg8-card .desc { font-size:12px; color:#6B7280; line-height:1.65; margin-bottom:14px; }
  .pmg8-card .arrow { font-size:12px; font-weight:800; color:#0F1F5C; transition:transform .25s; }
  .pmg8-card:hover .arrow { transform:translateX(4px); color:#EA580C; }
  @media (max-width:640px) { .pmg8-head h2 { font-size:24px; } }
  </style>
  <section class="pmg8">
    <div class="pmg8-inner">
      <div class="pmg8-head">
        <div class="kicker">EXPLORE MORE</div>
        <h2>카테고리별 더보기</h2>
        <p>관심 분야의 콘텐츠만 모아서 보세요</p>
      </div>
      <div class="pmg8-grid">
        <a class="pmg8-card" href="#"><div class="icon">🔧</div><div class="name">시공 방법</div><div class="count">86개 콘텐츠</div><div class="desc">단계별 시공 가이드 — 옥상·외벽·균열 등</div><div class="arrow">전체 보기 →</div></a>
        <a class="pmg8-card" href="#"><div class="icon">📊</div><div class="name">케이스 스터디</div><div class="count">62개 콘텐츠</div><div class="desc">실제 단지의 시공 전후 추적 기록</div><div class="arrow">전체 보기 →</div></a>
        <a class="pmg8-card" href="#"><div class="icon">📦</div><div class="name">제품 가이드</div><div class="count">48개 콘텐츠</div><div class="desc">자재별 사용법·비교·선택 가이드</div><div class="arrow">전체 보기 →</div></a>
        <a class="pmg8-card" href="#"><div class="icon">🛠️</div><div class="name">셀프시공</div><div class="count">36개 콘텐츠</div><div class="desc">초보자도 할 수 있는 셀프 시공법</div><div class="arrow">전체 보기 →</div></a>
        <a class="pmg8-card" href="#"><div class="icon">📈</div><div class="name">트렌드</div><div class="count">24개 콘텐츠</div><div class="desc">2026 컬러·디자인·시장 동향</div><div class="arrow">전체 보기 →</div></a>
        <a class="pmg8-card" href="#"><div class="icon">💼</div><div class="name">관리자 노하우</div><div class="count">28개 콘텐츠</div><div class="desc">관리소장·시설팀을 위한 실무 팁</div><div class="arrow">전체 보기 →</div></a>
        <a class="pmg8-card" href="#"><div class="icon">▶</div><div class="name">영상 가이드</div><div class="count">72개 영상</div><div class="desc">짧고 명확한 시공 시연 영상</div><div class="arrow">전체 보기 →</div></a>
        <a class="pmg8-card" href="#"><div class="icon">🎓</div><div class="name">기술·R&D</div><div class="count">18개 콘텐츠</div><div class="desc">POUR R&D 비하인드 — 신기술 개발기</div><div class="arrow">전체 보기 →</div></a>
      </div>
    </div>
  </section>`;


  const SEED_DPT_LOGIN_HTML = `<style>
  .dpt1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dpt1 { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:40px 24px; background:linear-gradient(135deg,#FFFBF5 0%,#FFF7ED 50%,#FFFBF5 100%); }
  .dpt1-card { background:#fff; border-radius:24px; padding:40px 36px; max-width:440px; width:100%; box-shadow:0 22px 48px rgba(15,31,92,.1); border:1px solid #E5E7EB; }
  .dpt1-icon { width:60px; height:60px; margin:0 auto 16px; border-radius:18px; background:linear-gradient(135deg,#F97316,#EA580C); display:grid; place-items:center; font-size:30px; color:#fff; box-shadow:0 8px 20px rgba(249,115,22,.3); }
  .dpt1-title { font-size:22px; font-weight:900; color:#0F1F5C; letter-spacing:-.6px; text-align:center; margin-bottom:6px; }
  .dpt1-sub { font-size:12.5px; color:#6B7280; font-weight:700; text-align:center; margin-bottom:28px; }
  .dpt1-label { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; display:block; }
  .dpt1-input { width:100%; padding:13px 16px; font-size:15px; font-weight:700; border:1px solid #E5E7EB; border-radius:9px; background:#F9FAFB; outline:none; margin-bottom:14px; color:#111827; }
  .dpt1-input.pin { font-size:18px; font-weight:800; letter-spacing:6px; text-align:center; }
  .dpt1-btn { width:100%; padding:14px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; font-size:14px; font-weight:900; border-radius:14px; box-shadow:0 6px 16px rgba(249,115,22,.3); border:none; margin-top:6px; cursor:pointer; }
  .dpt1-info { margin-top:18px; padding:12px 14px; background:#FFFBF5; border:1px solid #FFEDD5; border-radius:10px; font-size:11.5px; color:#4B5563; font-weight:700; line-height:1.6; }
  .dpt1-info b { color:#EA580C; }
  </style>
  <section class="dpt1">
    <div class="dpt1-card">
      <div class="dpt1-icon">🤝</div>
      <h1 class="dpt1-title">POUR스토어 포털</h1>
      <div class="dpt1-sub">파트너사 · 대리점 전용</div>
      <label class="dpt1-label">등록 전화번호</label>
      <input type="tel" class="dpt1-input" placeholder="010-0000-0000"/>
      <label class="dpt1-label">PIN (4자리 이상)</label>
      <input type="password" class="dpt1-input pin" value="******"/>
      <button class="dpt1-btn">로그인 →</button>
      <div class="dpt1-info">💡 PIN은 <b>POUR스토어 어드민</b>에서 발급받으세요. 파트너·대리점 자동 인식.</div>
    </div>
  </section>`;

  const SEED_DPT_HEADER_HTML = `<style>
  .dpt2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dpt2 { background:#fff; border-bottom:1px solid #E5E7EB; padding:16px 28px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
  .dpt2-left { display:flex; align-items:center; gap:14px; }
  .dpt2-icon { width:40px; height:40px; border-radius:11px; background:linear-gradient(135deg,#F97316,#EA580C); display:grid; place-items:center; font-size:18px; color:#fff; }
  .dpt2-meta { display:flex; align-items:center; gap:8px; margin-bottom:2px; }
  .dpt2-role { font-size:11px; font-weight:800; color:#6B7280; letter-spacing:.5px; text-transform:uppercase; }
  .dpt2-grade { padding:2px 7px; background:#FFFBF5; border:1px solid #FFEDD5; color:#EA580C; font-size:10px; font-weight:900; border-radius:4px; letter-spacing:.4px; }
  .dpt2-name { font-size:17px; font-weight:900; color:#0F1F5C; letter-spacing:-.4px; }
  .dpt2-right { display:flex; gap:8px; align-items:center; }
  .dpt2-phone { font-size:11.5px; color:#6B7280; font-weight:700; }
  .dpt2-logout { padding:8px 14px; border-radius:9px; font-size:12px; font-weight:800; color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; cursor:pointer; }
  </style>
  <header class="dpt2">
    <div class="dpt2-left">
      <div class="dpt2-icon">👷</div>
      <div>
        <div class="dpt2-meta">
          <span class="dpt2-role">파트너사</span>
          <span class="dpt2-grade">등급 A</span>
        </div>
        <h1 class="dpt2-name">한울방수 (예시)</h1>
      </div>
    </div>
    <div class="dpt2-right">
      <span class="dpt2-phone">010-0000-0000</span>
      <button class="dpt2-logout">🔒 로그아웃</button>
    </div>
  </header>`;

  const SEED_DPT_SUMMARY_HTML = `<style>
  .dpt3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dpt3 { padding:24px 28px; background:#F9FAFB; }
  .dpt3-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
  .dpt3-card { background:#fff; padding:16px 18px; border-radius:18px; border:1px solid #E5E7EB; box-shadow:0 1px 6px rgba(0,0,0,.07); }
  .dpt3-card.hi { background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border-color:#A7F3D0; }
  .dpt3-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .dpt3-lbl { font-size:11px; font-weight:800; color:#6B7280; letter-spacing:.4px; }
  .dpt3-ic { font-size:16px; }
  .dpt3-val { font-size:22px; font-weight:900; letter-spacing:-.5px; line-height:1.1; }
  .dpt3-val.or { color:#F97316; }
  .dpt3-val.amber { color:#D97706; }
  .dpt3-val.green { color:#059669; }
  .dpt3-val.navy { color:#0F1F5C; }
  </style>
  <section class="dpt3">
    <div class="dpt3-grid">
      <div class="dpt3-card"><div class="dpt3-row"><span class="dpt3-lbl">대기 중</span><span class="dpt3-ic">✋</span></div><div class="dpt3-val or">3건</div></div>
      <div class="dpt3-card"><div class="dpt3-row"><span class="dpt3-lbl">시공 중</span><span class="dpt3-ic">🏗</span></div><div class="dpt3-val amber">2건</div></div>
      <div class="dpt3-card hi"><div class="dpt3-row"><span class="dpt3-lbl">완료</span><span class="dpt3-ic">✅</span></div><div class="dpt3-val green">14건</div></div>
      <div class="dpt3-card"><div class="dpt3-row"><span class="dpt3-lbl">누적 배정</span><span class="dpt3-ic">📋</span></div><div class="dpt3-val navy">28건</div></div>
    </div>
  </section>`;

  const SEED_DPT_LIST_HTML = `<style>
  .dpt4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dpt4 { padding:0 28px 40px; background:#F9FAFB; }
  .dpt4-card { background:#fff; border-radius:18px; border:1px solid #E5E7EB; overflow:hidden; }
  .dpt4-head { padding:16px 20px; border-bottom:1px solid #E5E7EB; }
  .dpt4-h { font-size:14px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; }
  .dpt4-row { padding:14px 20px; border-bottom:1px solid #F3F4F6; cursor:pointer; }
  .dpt4-row:hover { background:#FFFBF5; }
  .dpt4-row:last-child { border-bottom:none; }
  .dpt4-meta { display:flex; align-items:center; gap:10px; margin-bottom:6px; flex-wrap:wrap; }
  .dpt4-status { padding:3px 9px; background:#FFEDD5; border:1px solid #FED7AA; color:#EA580C; font-size:10.5px; font-weight:900; border-radius:5px; }
  .dpt4-status.done { background:#D1FAE5; border-color:#6EE7B7; color:#047857; }
  .dpt4-cust { font-size:13.5px; font-weight:900; color:#0F1F5C; }
  .dpt4-info { font-size:11.5px; color:#6B7280; font-weight:700; }
  .dpt4-time { font-size:11px; color:#9CA3AF; font-weight:700; margin-left:auto; }
  .dpt4-desc { font-size:12px; color:#4B5563; font-weight:600; line-height:1.55; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  </style>
  <section class="dpt4">
    <div class="dpt4-card">
      <div class="dpt4-head"><h3 class="dpt4-h">🤝 배정된 시공연결 신청</h3></div>
      <div class="dpt4-row">
        <div class="dpt4-meta">
          <span class="dpt4-status">파트너통보</span>
          <b class="dpt4-cust">김○○ 관리소장</b>
          <span class="dpt4-info">서울 · 아파트</span>
          <span class="dpt4-time">2시간 전</span>
        </div>
        <div class="dpt4-desc">옥상 슬라브 누수 — 1,200세대, 약 50평 옥상 일괄 시공 희망</div>
      </div>
      <div class="dpt4-row">
        <div class="dpt4-meta">
          <span class="dpt4-status done">시공중</span>
          <b class="dpt4-cust">박○○ 시설팀장</b>
          <span class="dpt4-info">경기 · 관공서</span>
          <span class="dpt4-time">어제</span>
        </div>
        <div class="dpt4-desc">외벽 균열 보수 + 재도장 (고급형) — 본관 4개동, 일정 협의 완료</div>
      </div>
      <div class="dpt4-row">
        <div class="dpt4-meta">
          <span class="dpt4-status">파트너통보</span>
          <b class="dpt4-cust">이○○ 입주자대표</b>
          <span class="dpt4-info">부산 · 아파트</span>
          <span class="dpt4-time">3일 전</span>
        </div>
        <div class="dpt4-desc">박공지붕 슁글 누수 — 23층 고층, 신기술 1026호 시공 가능 여부 확인 필요</div>
      </div>
    </div>
  </section>`;

  const SEED_DPT_DETAIL_HTML = `<style>
  .dpt5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dpt5 { padding:30px; background:rgba(15,31,92,.45); display:flex; align-items:center; justify-content:center; min-height:100vh; backdrop-filter:blur(2px); }
  .dpt5-modal { background:#fff; border-radius:18px; max-width:680px; width:100%; box-shadow:0 12px 36px rgba(0,0,0,.25); overflow:hidden; }
  .dpt5-head { padding:20px 24px; border-bottom:1px solid #E5E7EB; display:flex; align-items:center; justify-content:space-between; }
  .dpt5-h { font-size:16px; font-weight:900; color:#0F1F5C; }
  .dpt5-x { width:32px; height:32px; border-radius:8px; color:#6B7280; font-size:18px; background:none; border:none; cursor:pointer; }
  .dpt5-body { padding:22px 24px; }
  .dpt5-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
  .dpt5-info { }
  .dpt5-info-l { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:5px; }
  .dpt5-info-v { padding:10px 14px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:9px; font-size:13px; font-weight:600; color:#111827; }
  .dpt5-fld { margin-bottom:14px; }
  .dpt5-fld label { display:block; font-size:11px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .dpt5-sel { width:100%; padding:10px 14px; border:1px solid #E5E7EB; border-radius:9px; font-size:13px; font-weight:600; background:#F9FAFB; }
  .dpt5-ta { width:100%; padding:10px 14px; border:1px solid #E5E7EB; border-radius:9px; font-size:13px; min-height:80px; resize:vertical; background:#F9FAFB; font-weight:600; }
  .dpt5-foot { display:flex; gap:8px; padding-top:18px; border-top:1px solid #F3F4F6; justify-content:flex-end; }
  .dpt5-btn-g { padding:11px 20px; background:#fff; color:#4B5563; border:1px solid #E5E7EB; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; }
  .dpt5-btn-p { padding:11px 20px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-radius:9px; font-size:13px; font-weight:800; box-shadow:0 4px 12px rgba(249,115,22,.25); border:none; cursor:pointer; }
  </style>
  <section class="dpt5">
    <div class="dpt5-modal">
      <div class="dpt5-head">
        <h3 class="dpt5-h">신청 상세 — 김○○</h3>
        <button class="dpt5-x">✕</button>
      </div>
      <div class="dpt5-body">
        <div class="dpt5-grid">
          <div class="dpt5-info"><div class="dpt5-info-l">고객명</div><div class="dpt5-info-v">김○○</div></div>
          <div class="dpt5-info"><div class="dpt5-info-l">연락처</div><div class="dpt5-info-v">010-0000-0000</div></div>
          <div class="dpt5-info"><div class="dpt5-info-l">지역</div><div class="dpt5-info-v">서울</div></div>
          <div class="dpt5-info"><div class="dpt5-info-l">건물 유형</div><div class="dpt5-info-v">아파트</div></div>
        </div>
        <div class="dpt5-fld">
          <label>상태 업데이트</label>
          <select class="dpt5-sel"><option>파트너통보</option><option>확정 (시공 진행 결정)</option><option>시공중</option><option>완료</option></select>
        </div>
        <div class="dpt5-fld">
          <label>파트너 메모</label>
          <textarea class="dpt5-ta" placeholder="현장 상황·일정·고객 협의 내용 등"></textarea>
        </div>
        <div class="dpt5-foot">
          <button class="dpt5-btn-g">취소</button>
          <button class="dpt5-btn-p">저장</button>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_DLR_LOGIN_HTML = SEED_DPT_LOGIN_HTML;  // 동일 로그인 화면 (역할만 자동 감지)

  const SEED_DLR_HEADER_HTML = `<style>
  .dlr2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dlr2 { background:#fff; border-bottom:1px solid #E5E7EB; padding:16px 28px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
  .dlr2-left { display:flex; align-items:center; gap:14px; }
  .dlr2-icon { width:40px; height:40px; border-radius:11px; background:linear-gradient(135deg,#F97316,#EA580C); display:grid; place-items:center; font-size:18px; color:#fff; }
  .dlr2-meta { display:flex; align-items:center; gap:8px; margin-bottom:2px; flex-wrap:wrap; }
  .dlr2-role { font-size:11px; font-weight:800; color:#6B7280; letter-spacing:.5px; text-transform:uppercase; }
  .dlr2-tier { padding:2px 7px; background:#FFF7ED; border:1px solid #FED7AA; color:#EA580C; font-size:10px; font-weight:900; border-radius:4px; letter-spacing:.4px; }
  .dlr2-name { font-size:17px; font-weight:900; color:#0F1F5C; letter-spacing:-.4px; }
  .dlr2-logout { padding:8px 14px; border-radius:9px; font-size:12px; font-weight:800; color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; cursor:pointer; }
  </style>
  <header class="dlr2">
    <div class="dlr2-left">
      <div class="dlr2-icon">🏪</div>
      <div>
        <div class="dlr2-meta">
          <span class="dlr2-role">대리점</span>
          <span class="dlr2-tier">⭐ GOLD · 28%</span>
        </div>
        <h1 class="dlr2-name">○○건축자재 (예시)</h1>
      </div>
    </div>
    <button class="dlr2-logout">🔒 로그아웃</button>
  </header>`;

  const SEED_DLR_CTA_HTML = `<style>
  .dlr3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dlr3 { padding:24px 28px; background:#F9FAFB; }
  .dlr3-grid { display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr; gap:12px; }
  .dlr3-cta { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-radius:18px; padding:22px 24px; text-align:left; box-shadow:0 12px 28px rgba(249,115,22,.32); cursor:pointer; border:none; }
  .dlr3-cta-l { font-size:11px; font-weight:800; letter-spacing:.8px; opacity:.9; margin-bottom:6px; }
  .dlr3-cta-h { font-size:22px; font-weight:900; letter-spacing:-.6px; margin-bottom:6px; }
  .dlr3-cta-d { font-size:11.5px; opacity:.9; font-weight:700; }
  .dlr3-card { background:#fff; padding:16px 18px; border-radius:18px; border:1px solid #E5E7EB; box-shadow:0 1px 6px rgba(0,0,0,.07); }
  .dlr3-card.hi { background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border-color:#A7F3D0; }
  .dlr3-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .dlr3-l { font-size:11px; font-weight:800; color:#6B7280; letter-spacing:.4px; }
  .dlr3-ic { font-size:16px; }
  .dlr3-v { font-size:22px; font-weight:900; letter-spacing:-.5px; line-height:1.1; }
  .dlr3-v.navy { color:#0F1F5C; }
  .dlr3-v.or { color:#F97316; font-size:17px; }
  .dlr3-v.green { color:#059669; font-size:17px; }
  @media (max-width:880px) { .dlr3-grid { grid-template-columns:1fr 1fr; } }
  </style>
  <section class="dlr3">
    <div class="dlr3-grid">
      <button class="dlr3-cta">
        <div class="dlr3-cta-l">NEW ORDER</div>
        <div class="dlr3-cta-h">+ 새 주문 작성</div>
        <div class="dlr3-cta-d">고객 정보 + 품목 입력 → POUR스토어 결제 안내</div>
      </button>
      <div class="dlr3-card"><div class="dlr3-row"><span class="dlr3-l">이달 주문 수</span><span class="dlr3-ic">🛒</span></div><div class="dlr3-v navy">12건</div></div>
      <div class="dlr3-card"><div class="dlr3-row"><span class="dlr3-l">이달 매출 (고객 결제)</span><span class="dlr3-ic">💰</span></div><div class="dlr3-v or">8,640,000원</div></div>
      <div class="dlr3-card hi"><div class="dlr3-row"><span class="dlr3-l">예상 수수료 (28%)</span><span class="dlr3-ic">💵</span></div><div class="dlr3-v green">2,419,200원</div></div>
    </div>
  </section>`;

  const SEED_DLR_SETTLE_HTML = `<style>
  .dlr4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dlr4 { padding:0 28px 18px; background:#F9FAFB; }
  .dlr4-box { padding:14px 18px; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .dlr4-ic { font-size:20px; }
  .dlr4-text { flex:1; font-size:12.5px; color:#4B5563; line-height:1.65; font-weight:700; }
  .dlr4-text b { color:#059669; }
  </style>
  <section class="dlr4">
    <div class="dlr4-box">
      <span class="dlr4-ic">💸</span>
      <div class="dlr4-text"><b>월말 자동 정산</b> · 고객이 POUR스토어로 직접 결제 → 매월 마지막 영업일에 대리점 등록 계좌로 수수료 입금</div>
    </div>
  </section>`;

  const SEED_DLR_ORDERS_HTML = `<style>
  .dlr5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dlr5 { padding:0 28px 40px; background:#F9FAFB; }
  .dlr5-card { background:#fff; border-radius:18px; border:1px solid #E5E7EB; overflow:hidden; }
  .dlr5-head { padding:16px 20px; border-bottom:1px solid #E5E7EB; display:flex; justify-content:space-between; align-items:center; }
  .dlr5-h { font-size:14px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; }
  .dlr5-meta { font-size:11.5px; color:#6B7280; font-weight:700; }
  .dlr5-table { width:100%; font-size:12.5px; border-collapse:collapse; }
  .dlr5-table th { padding:10px 14px; text-align:left; font-size:11px; font-weight:800; color:#6B7280; letter-spacing:.3px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; }
  .dlr5-table th.r { text-align:right; }
  .dlr5-table td { padding:10px 14px; border-bottom:1px solid #F3F4F6; vertical-align:middle; }
  .dlr5-table td.r { text-align:right; font-weight:800; }
  .dlr5-table td.r.navy { color:#0F1F5C; }
  .dlr5-table td.r.green { color:#059669; }
  .dlr5-status { padding:3px 9px; font-size:10.5px; font-weight:900; border-radius:5px; }
  .dlr5-status.wait { background:#FEF3C7; border:1px solid #FCD34D; color:#B45309; }
  .dlr5-status.paid { background:#DBEAFE; border:1px solid #93C5FD; color:#1E40AF; }
  .dlr5-status.done { background:#D1FAE5; border:1px solid #6EE7B7; color:#047857; }
  .dlr5-no { font-family:monospace; font-weight:700; color:#4B5563; }
  .dlr5-cust b { color:#0F1F5C; font-weight:900; }
  .dlr5-cust div { font-size:10.5px; color:#9CA3AF; font-weight:700; margin-top:2px; }
  </style>
  <section class="dlr5">
    <div class="dlr5-card">
      <div class="dlr5-head">
        <h3 class="dlr5-h">📋 최근 주문 (12)</h3>
        <span class="dlr5-meta">최신순 10건 표시</span>
      </div>
      <table class="dlr5-table">
        <thead><tr><th>상태</th><th>주문번호</th><th>주문일</th><th>고객</th><th>품목</th><th class="r">매출</th><th class="r">수수료</th></tr></thead>
        <tbody>
          <tr><td><span class="dlr5-status wait">결제대기</span></td><td><span class="dlr5-no">OR-12345678</span></td><td>05-03 14:20</td><td class="dlr5-cust"><b>홍길동</b><div>010-0000-0000</div></td><td>3건</td><td class="r navy">240,000원</td><td class="r green">67,200원</td></tr>
          <tr><td><span class="dlr5-status paid">결제완료</span></td><td><span class="dlr5-no">OR-12345677</span></td><td>05-02 11:35</td><td class="dlr5-cust"><b>김철수</b><div>010-1234-5678</div></td><td>5건</td><td class="r navy">528,000원</td><td class="r green">147,840원</td></tr>
          <tr><td><span class="dlr5-status done">완료</span></td><td><span class="dlr5-no">OR-12345676</span></td><td>04-30 16:10</td><td class="dlr5-cust"><b>박영희</b><div>010-9876-5432</div></td><td>2건</td><td class="r navy">128,000원</td><td class="r green">35,840원</td></tr>
        </tbody>
      </table>
    </div>
  </section>`;

  const SEED_DLR_NEW_HTML = `<style>
  .dlr6 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .dlr6 { padding:30px; background:rgba(15,31,92,.45); display:flex; align-items:center; justify-content:center; min-height:100vh; backdrop-filter:blur(2px); }
  .dlr6-modal { background:#fff; border-radius:18px; max-width:760px; width:100%; box-shadow:0 12px 36px rgba(0,0,0,.25); overflow:hidden; max-height:92vh; display:flex; flex-direction:column; }
  .dlr6-head { padding:20px 24px; border-bottom:1px solid #E5E7EB; display:flex; align-items:center; justify-content:space-between; }
  .dlr6-h { font-size:16px; font-weight:900; color:#0F1F5C; }
  .dlr6-x { width:32px; height:32px; border-radius:8px; color:#6B7280; font-size:18px; background:none; border:none; }
  .dlr6-body { padding:22px 24px; overflow-y:auto; flex:1; }
  .dlr6-notice { padding:12px 14px; background:#FFFBF5; border:1px solid #FFEDD5; border-radius:10px; font-size:12px; color:#4B5563; font-weight:700; line-height:1.65; margin-bottom:16px; }
  .dlr6-notice b { color:#EA580C; }
  .dlr6-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
  .dlr6-fld label { display:block; font-size:11px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:6px; }
  .dlr6-input { width:100%; padding:10px 14px; border:1px solid #E5E7EB; border-radius:9px; font-size:13px; font-weight:600; background:#F9FAFB; }
  .dlr6-table { background:#F9FAFB; border:1px solid #E5E7EB; border-radius:10px; overflow:hidden; margin-top:8px; }
  .dlr6-trow { display:grid; grid-template-columns:1fr 80px 130px 130px 36px; gap:8px; padding:10px 12px; font-size:11px; font-weight:800; color:#6B7280; background:#fff; border-bottom:1px solid #E5E7EB; letter-spacing:.3px; }
  .dlr6-trow.r { text-align:right; }
  .dlr6-tbody { display:grid; grid-template-columns:1fr 80px 130px 130px 36px; gap:8px; padding:8px 12px; align-items:center; border-bottom:1px solid #F3F4F6; }
  .dlr6-input-sm { padding:7px 10px; font-size:12.5px; border:1px solid #E5E7EB; border-radius:6px; background:#fff; }
  .dlr6-add { padding:7px 14px; border-radius:8px; font-size:12px; font-weight:800; color:#EA580C; background:#FFFBF5; border:1px solid #FFEDD5; cursor:pointer; margin:10px 14px; }
  .dlr6-summary { padding:16px; background:#F9FAFB; border-radius:12px; margin-top:14px; }
  .dlr6-srow { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
  .dlr6-srow.bd { padding-top:10px; border-top:1px solid #E5E7EB; margin-bottom:0; }
  .dlr6-stext { font-size:12px; color:#4B5563; font-weight:700; }
  .dlr6-stext.com { font-size:11.5px; color:#059669; font-weight:800; }
  .dlr6-sval { font-size:18px; font-weight:900; color:#0F1F5C; }
  .dlr6-sval.com { font-size:16px; color:#059669; }
  .dlr6-foot { padding:18px 24px; border-top:1px solid #E5E7EB; display:flex; gap:8px; justify-content:flex-end; }
  .dlr6-bg { padding:11px 20px; background:#fff; color:#4B5563; border:1px solid #E5E7EB; border-radius:9px; font-size:13px; font-weight:700; }
  .dlr6-bp { padding:11px 20px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-radius:9px; font-size:13px; font-weight:800; box-shadow:0 4px 12px rgba(249,115,22,.25); border:none; }
  </style>
  <section class="dlr6">
    <div class="dlr6-modal">
      <div class="dlr6-head">
        <h3 class="dlr6-h">새 주문 작성</h3>
        <button class="dlr6-x">✕</button>
      </div>
      <div class="dlr6-body">
        <div class="dlr6-notice">💳 <b>고객은 POUR스토어로 직접 결제</b>합니다 (대리점 카드/계좌 사용 X) · 매월 말 정산 시 수수료 28% 입금</div>
        <div class="dlr6-grid">
          <div class="dlr6-fld"><label>고객명 *</label><input class="dlr6-input" placeholder="홍길동"/></div>
          <div class="dlr6-fld"><label>연락처 *</label><input class="dlr6-input" placeholder="010-0000-0000"/></div>
        </div>
        <div class="dlr6-fld" style="margin-bottom:14px;"><label>배송 주소</label><input class="dlr6-input" placeholder="○○도 ○○시 ○○로"/></div>
        <div class="dlr6-fld"><label>주문 품목</label></div>
        <div class="dlr6-table">
          <div class="dlr6-trow"><span>품목</span><span class="r">수량</span><span class="r">단가</span><span class="r">합계</span><span></span></div>
          <div class="dlr6-tbody"><input class="dlr6-input-sm" placeholder="POUR 코트재 5kg" value="POUR 코트재 5kg"/><input class="dlr6-input-sm" style="text-align:right" value="2"/><input class="dlr6-input-sm" style="text-align:right" value="68000"/><div style="text-align:right;font-weight:800;color:#0F1F5C;font-size:12.5px">136,000원</div><button style="width:30px;height:30px;border-radius:6px;color:#DC2626;font-size:14px;background:none;border:none">✕</button></div>
          <button class="dlr6-add">+ 품목 추가</button>
        </div>
        <div class="dlr6-summary">
          <div class="dlr6-srow"><span class="dlr6-stext">고객 결제 금액</span><span class="dlr6-sval">136,000원</span></div>
          <div class="dlr6-srow bd"><span class="dlr6-stext com">예상 정산 수수료 (28%)</span><span class="dlr6-sval com">38,080원</span></div>
        </div>
      </div>
      <div class="dlr6-foot">
        <button class="dlr6-bg">취소</button>
        <button class="dlr6-bp">주문 등록 →</button>
      </div>
    </div>
  </section>`;

  const SEED_KSK_SETUP_HTML = `<style>
  .ksk1 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .ksk1 { width:100%; min-height:100vh; display:grid; place-items:center; padding:40px; background:linear-gradient(135deg,#FFFBF5 0%,#FFF7ED 50%,#FFFBF5 100%); }
  .ksk1-card { background:#fff; border-radius:28px; padding:48px 44px; max-width:520px; width:100%; box-shadow:0 22px 60px rgba(15,31,92,.15); border:1px solid #E5E7EB; }
  .ksk1-icon { width:72px; height:72px; margin:0 auto 18px; border-radius:22px; background:linear-gradient(135deg,#F97316,#EA580C); display:grid; place-items:center; font-size:36px; color:#fff; box-shadow:0 10px 24px rgba(249,115,22,.3); }
  .ksk1-h { font-size:28px; font-weight:900; color:#0F1F5C; letter-spacing:-.8px; text-align:center; margin-bottom:8px; }
  .ksk1-d { font-size:14px; color:#4B5563; font-weight:700; text-align:center; line-height:1.65; margin-bottom:32px; }
  .ksk1-fld { margin-bottom:14px; }
  .ksk1-fld label { display:block; font-size:12px; font-weight:800; color:#EA580C; letter-spacing:.5px; margin-bottom:8px; }
  .ksk1-input { width:100%; padding:16px 20px; font-size:18px; font-weight:700; border:2px solid #E5E7EB; border-radius:14px; background:#F9FAFB; outline:none; }
  .ksk1-input.pin { font-size:22px; font-weight:800; letter-spacing:8px; text-align:center; }
  .ksk1-btn { width:100%; padding:18px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; font-size:16px; font-weight:900; border-radius:14px; box-shadow:0 8px 22px rgba(249,115,22,.35); border:none; cursor:pointer; }
  </style>
  <section class="ksk1">
    <div class="ksk1-card">
      <div class="ksk1-icon">📱</div>
      <h1 class="ksk1-h">키오스크 초기 설정</h1>
      <p class="ksk1-d">대리점 계정으로 1회 바인딩하면<br/>이 태블릿이 매장 키오스크로 작동합니다</p>
      <div class="ksk1-fld">
        <label>대리점 전화번호</label>
        <input type="tel" class="ksk1-input" placeholder="010-0000-0000"/>
      </div>
      <div class="ksk1-fld">
        <label>PIN (4자리 이상)</label>
        <input type="password" class="ksk1-input pin" value="******"/>
      </div>
      <button class="ksk1-btn">키오스크 시작 →</button>
    </div>
  </section>`;

  const SEED_KSK_WELCOME_HTML = `<style>
  .ksk2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .ksk2 { width:100%; min-height:100vh; display:grid; place-items:center; padding:40px; background:linear-gradient(135deg,#FFFBF5 0%,#FFF7ED 50%,#FFFBF5 100%); position:relative; }
  .ksk2-admin { position:absolute; top:18px; right:18px; padding:8px 14px; border-radius:9px; font-size:12px; font-weight:800; color:#6B7280; background:rgba(255,255,255,.7); border:1px solid #E5E7EB; cursor:pointer; }
  .ksk2-c { text-align:center; max-width:720px; }
  .ksk2-bigicon { width:120px; height:120px; margin:0 auto 32px; border-radius:32px; background:linear-gradient(135deg,#F97316,#EA580C); display:grid; place-items:center; font-size:60px; color:#fff; box-shadow:0 16px 40px rgba(249,115,22,.35); animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.04); } }
  .ksk2-tag { font-size:14px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:14px; }
  .ksk2-h { font-size:48px; font-weight:900; color:#0F1F5C; letter-spacing:-1.5px; line-height:1.2; margin-bottom:18px; }
  .ksk2-h .or { color:#F97316; }
  .ksk2-d { font-size:18px; color:#4B5563; line-height:1.7; font-weight:700; margin-bottom:36px; max-width:520px; margin-left:auto; margin-right:auto; }
  .ksk2-pill { display:inline-flex; align-items:center; gap:12px; padding:14px 24px; background:#fff; border:1px solid #FFEDD5; border-radius:14px; font-size:13px; color:#4B5563; font-weight:700; box-shadow:0 4px 12px rgba(0,0,0,.05); }
  .ksk2-dot { width:8px; height:8px; border-radius:50%; background:#059669; box-shadow:0 0 0 4px rgba(5,150,105,.2); animation:pulse 2s infinite; }
  .ksk2-trust { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; padding-top:32px; border-top:1px solid #E5E7EB; margin-top:48px; max-width:600px; margin-left:auto; margin-right:auto; font-size:13px; color:#4B5563; }
  .ksk2-trust-ic { font-size:24px; margin-bottom:6px; }
  .ksk2-trust-h { font-weight:900; color:#0F1F5C; margin-bottom:4px; }
  .ksk2-trust-d { font-size:11.5px; font-weight:700; }
  @media (max-width:640px) { .ksk2-h { font-size:32px; } }
  </style>
  <section class="ksk2">
    <button class="ksk2-admin">⚙ 키오스크 설정</button>
    <div class="ksk2-c">
      <div class="ksk2-bigicon">🛒</div>
      <div class="ksk2-tag">POUR스토어 매장 키오스크</div>
      <h1 class="ksk2-h">어서오세요!<br/><span class="or">○○건축자재</span>입니다</h1>
      <p class="ksk2-d">매장 직원에게 원하시는 자재를 말씀해 주세요.<br/>주문 입력이 시작되면 이 화면에 자동 표시됩니다.</p>
      <div class="ksk2-pill"><span class="ksk2-dot"></span>신규 주문 대기 중...</div>
      <div class="ksk2-trust">
        <div><div class="ksk2-trust-ic">🛡️</div><div class="ksk2-trust-h">R&D 검증</div><div class="ksk2-trust-d">건설신기술 1026호</div></div>
        <div><div class="ksk2-trust-ic">📺</div><div class="ksk2-trust-h">시공 영상 무료</div><div class="ksk2-trust-d">구매 패키지마다 제공</div></div>
        <div><div class="ksk2-trust-ic">🏆</div><div class="ksk2-trust-h">250만+ 시공</div><div class="ksk2-trust-d">전국 검증 사례</div></div>
      </div>
    </div>
  </section>`;

  const SEED_KSK_DISPLAY_HTML = `<style>
  .ksk3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .ksk3 { width:100%; min-height:100vh; padding:28px 36px; background:linear-gradient(135deg,#FFFBF5 0%,#FFF7ED 50%,#FFFBF5 100%); }
  .ksk3-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
  .ksk3-head-l { display:flex; align-items:center; gap:12px; }
  .ksk3-head-icon { width:46px; height:46px; border-radius:14px; background:linear-gradient(135deg,#F97316,#EA580C); display:grid; place-items:center; font-size:22px; color:#fff; }
  .ksk3-shop { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:1px; margin-bottom:2px; }
  .ksk3-title { font-size:22px; font-weight:900; color:#0F1F5C; letter-spacing:-.6px; }
  .ksk3-no { padding:8px 16px; background:#fff; border:1px solid #E5E7EB; border-radius:10px; font-size:13px; font-weight:800; color:#4B5563; }
  .ksk3-no-v { color:#EA580C; font-family:monospace; margin-left:6px; }
  .ksk3-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:20px; }
  .ksk3-items { background:#fff; border-radius:20px; border:1px solid #E5E7EB; overflow:hidden; box-shadow:0 6px 18px rgba(15,31,92,.06); }
  .ksk3-items-head { padding:16px 22px; background:linear-gradient(135deg,#FFFBF5,#fff); border-bottom:1px solid #E5E7EB; }
  .ksk3-items-head-l { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:.8px; margin-bottom:4px; }
  .ksk3-items-head-h { font-size:18px; font-weight:900; color:#0F1F5C; letter-spacing:-.4px; }
  .ksk3-row { display:grid; grid-template-columns:1fr auto auto; gap:12px; padding:14px 22px; border-bottom:1px solid #F3F4F6; align-items:center; }
  .ksk3-row:last-child { border-bottom:none; }
  .ksk3-name { font-size:14px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; margin-bottom:2px; }
  .ksk3-d { font-size:11.5px; color:#6B7280; font-weight:700; }
  .ksk3-qty { font-size:11px; color:#6B7280; font-weight:700; padding:3px 9px; background:#F9FAFB; border-radius:6px; }
  .ksk3-sub { font-size:16px; font-weight:900; color:#EA580C; min-width:110px; text-align:right; }
  .ksk3-total { padding:18px 22px; background:#0F1F5C; color:#fff; display:flex; align-items:center; justify-content:space-between; }
  .ksk3-total-l { font-size:14px; font-weight:800; opacity:.85; }
  .ksk3-total-v { font-family:'Bebas Neue',sans-serif; font-size:36px; font-weight:900; letter-spacing:.5px; }
  .ksk3-total-w { font-family:'Pretendard',sans-serif; font-size:18px; margin-left:6px; opacity:.85; }
  .ksk3-qr { background:linear-gradient(135deg,#FFFBF5,#fff); border-radius:20px; border:1px solid #FFEDD5; padding:24px 20px; text-align:center; box-shadow:0 6px 18px rgba(249,115,22,.1); }
  .ksk3-qr-l { font-size:11px; font-weight:800; color:#EA580C; letter-spacing:.8px; margin-bottom:6px; }
  .ksk3-qr-h { font-size:17px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; line-height:1.4; margin-bottom:14px; }
  .ksk3-qr-img { display:inline-block; padding:14px; background:#fff; border-radius:14px; box-shadow:0 6px 24px rgba(15,31,92,.15); margin-bottom:14px; }
  .ksk3-qr-img svg { display:block; }
  .ksk3-qr-d { display:flex; flex-direction:column; gap:6px; font-size:12.5px; color:#4B5563; font-weight:700; line-height:1.6; }
  .ksk3-qr-note { margin-top:14px; padding:10px 12px; background:#fff; border:1px dashed #FFEDD5; border-radius:10px; font-size:11px; color:#4B5563; font-weight:700; }
  .ksk3-qr-note b { color:#EA580C; }
  .ksk3-cust { margin-top:18px; padding:12px 18px; background:#fff; border:1px solid #E5E7EB; border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:13px; font-weight:700; color:#4B5563; }
  .ksk3-cust b { color:#0F1F5C; font-weight:900; }
  @media (max-width:880px) { .ksk3-grid { grid-template-columns:1fr; } }
  </style>
  <section class="ksk3">
    <div class="ksk3-head">
      <div class="ksk3-head-l">
        <div class="ksk3-head-icon">🛒</div>
        <div>
          <div class="ksk3-shop">○○건축자재</div>
          <h1 class="ksk3-title">주문 확인</h1>
        </div>
      </div>
      <div class="ksk3-no">주문번호<span class="ksk3-no-v">OR-12345678</span></div>
    </div>
    <div class="ksk3-grid">
      <div class="ksk3-items">
        <div class="ksk3-items-head">
          <div class="ksk3-items-head-l">📋 ORDER ITEMS</div>
          <h2 class="ksk3-items-head-h">고객님 주문 내역</h2>
        </div>
        <div class="ksk3-row">
          <div><div class="ksk3-name">POUR 코트재 5kg</div><div class="ksk3-d">68,000원 × 2</div></div>
          <div class="ksk3-qty">2개</div>
          <div class="ksk3-sub">136,000원</div>
        </div>
        <div class="ksk3-row">
          <div><div class="ksk3-name">슈퍼복합압축시트</div><div class="ksk3-d">128,000원 × 1</div></div>
          <div class="ksk3-qty">1개</div>
          <div class="ksk3-sub">128,000원</div>
        </div>
        <div class="ksk3-total">
          <span class="ksk3-total-l">총 결제 금액</span>
          <span class="ksk3-total-v">264,000<span class="ksk3-total-w">원</span></span>
        </div>
      </div>
      <div class="ksk3-qr">
        <div class="ksk3-qr-l">💳 PAYMENT</div>
        <h2 class="ksk3-qr-h">QR을 스캔해서<br/>POUR스토어로 직접 결제</h2>
        <div class="ksk3-qr-img">
          <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#fff"/>
            <g fill="#0F1F5C">
              <rect x="20" y="20" width="40" height="40"/><rect x="140" y="20" width="40" height="40"/><rect x="20" y="140" width="40" height="40"/>
              <rect x="30" y="30" width="20" height="20" fill="#fff"/><rect x="150" y="30" width="20" height="20" fill="#fff"/><rect x="30" y="150" width="20" height="20" fill="#fff"/>
              <rect x="80" y="30" width="10" height="10"/><rect x="100" y="30" width="10" height="10"/><rect x="120" y="40" width="10" height="10"/>
              <rect x="80" y="60" width="10" height="10"/><rect x="100" y="70" width="10" height="10"/><rect x="80" y="90" width="40" height="10"/>
              <rect x="140" y="90" width="20" height="10"/><rect x="170" y="100" width="10" height="10"/><rect x="80" y="110" width="10" height="10"/>
              <rect x="100" y="120" width="20" height="10"/><rect x="140" y="130" width="10" height="20"/><rect x="170" y="140" width="10" height="10"/>
              <rect x="80" y="150" width="10" height="20"/><rect x="100" y="160" width="20" height="10"/><rect x="140" y="170" width="40" height="10"/>
            </g>
          </svg>
        </div>
        <div class="ksk3-qr-d">
          <div>📱 카메라로 QR 스캔</div>
          <div>💳 카드/계좌이체 가능</div>
          <div>🛡 영수증 자동 발송</div>
        </div>
        <div class="ksk3-qr-note">결제는 <b>POUR스토어 본사</b>로 직접 이뤄집니다</div>
      </div>
    </div>
    <div class="ksk3-cust">
      <span>주문자: <b>홍길동</b> · 010-0000-0000</span>
      <span style="font-size:11px;color:#9CA3AF">서울 강남구 ○○로 ○○</span>
    </div>
  </section>`;

  const SEED_KSK_PAID_HTML = `<style>
  .ksk4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Pretendard',sans-serif; }
  .ksk4 { width:100%; min-height:100vh; display:grid; place-items:center; padding:40px; background:linear-gradient(135deg,#ECFDF5,#D1FAE5); }
  .ksk4-c { text-align:center; max-width:560px; }
  .ksk4-icon { width:120px; height:120px; margin:0 auto 32px; border-radius:50%; background:#fff; display:grid; place-items:center; font-size:60px; box-shadow:0 16px 40px rgba(5,150,105,.3); animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.04); } }
  .ksk4-h { font-size:42px; font-weight:900; color:#0F1F5C; letter-spacing:-1.2px; margin-bottom:14px; }
  .ksk4-d { font-size:17px; color:#4B5563; line-height:1.7; font-weight:700; margin-bottom:24px; }
  .ksk4-no { padding:16px 24px; background:#fff; border-radius:14px; border:1px solid #ECFDF5; display:inline-block; }
  .ksk4-no-l { font-size:11px; font-weight:800; color:#059669; letter-spacing:.5px; margin-bottom:4px; }
  .ksk4-no-v { font-size:18px; font-weight:900; color:#0F1F5C; font-family:monospace; }
  </style>
  <section class="ksk4">
    <div class="ksk4-c">
      <div class="ksk4-icon">✅</div>
      <h1 class="ksk4-h">결제 완료!</h1>
      <p class="ksk4-d">주문이 정상 접수되었습니다.<br/>POUR스토어가 빠르게 처리해 드릴게요.</p>
      <div class="ksk4-no">
        <div class="ksk4-no-l">주문번호</div>
        <div class="ksk4-no-v">OR-12345678</div>
      </div>
    </div>
  </section>`;


  // ─────────────────────────────────────────────
  // 자사몰 포스팅 (오하우스 스타일) — 사진 핀 → 상품 연결
  // 5개 섹션: 헤더 / 인터랙티브 갤러리 / 본문 / 사용 제품 / 댓글
  // ─────────────────────────────────────────────
  const SEED_OH_HEAD_HTML = `
<style>
.ohh * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.ohh { max-width:760px; margin:0 auto; padding:30px 22px 18px; background:#fff; }
.ohh-cat { display:inline-block; padding:5px 12px; background:#FFEDD5; color:#EA580C; font-size:11.5px; font-weight:800; border-radius:999px; margin-bottom:14px; letter-spacing:.3px; }
.ohh-h { font-size:26px; font-weight:900; color:#0F1F5C; line-height:1.35; letter-spacing:-.4px; margin-bottom:18px; }
.ohh-author { display:flex; align-items:center; gap:12px; padding-bottom:18px; border-bottom:1px solid #F3F4F6; }
.ohh-av { width:46px; height:46px; border-radius:50%; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; display:grid; place-items:center; font-size:18px; font-weight:900; flex-shrink:0; }
.ohh-author .info { flex:1; min-width:0; }
.ohh-author .nm { font-size:14.5px; font-weight:800; color:#111827; display:flex; align-items:center; gap:6px; }
.ohh-author .nm .badge { font-size:10px; padding:2px 7px; background:#FEF3C7; color:#B45309; border-radius:4px; font-weight:800; }
.ohh-author .meta { font-size:12px; color:#9CA3AF; margin-top:3px; }
.ohh-author .follow { padding:8px 16px; background:#fff; border:1.5px solid #F97316; color:#EA580C; font-size:12.5px; font-weight:800; border-radius:8px; cursor:pointer; }
.ohh-author .follow:hover { background:#F97316; color:#fff; }
.ohh-stats { display:flex; gap:20px; margin-top:18px; font-size:12.5px; color:#6B7280; font-weight:600; }
.ohh-stats span b { color:#0F1F5C; font-weight:800; }
@media(max-width:640px){ .ohh-h{ font-size:22px; } .ohh{ padding:24px 16px 14px; } }
</style>
<section class="ohh">
  <span class="ohh-cat">홈데코 · 거실 인테리어</span>
  <h1 class="ohh-h">미니멀 거실에 모네 액자 한 점 — 작은 공간을 갤러리로 만드는 방법</h1>
  <div class="ohh-author">
    <div class="ohh-av">민</div>
    <div class="info">
      <div class="nm">민지의집 <span class="badge">에디터</span></div>
      <div class="meta">2026.04.28 · 32평 아파트 · 경기 성남</div>
    </div>
    <button class="follow">+ 팔로우</button>
  </div>
  <div class="ohh-stats">
    <span>조회 <b>3,842</b></span>
    <span>좋아요 <b>284</b></span>
    <span>스크랩 <b>156</b></span>
    <span>댓글 <b>42</b></span>
  </div>
</section>`;

  const SEED_OH_GALLERY_HTML = `
<style>
.ohg * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.ohg { max-width:760px; margin:0 auto; padding:0 22px 24px; }
.ohg-stage { position:relative; width:100%; aspect-ratio:4/3; border-radius:14px; overflow:hidden; background:#F3F4F6; box-shadow:0 4px 24px rgba(15,31,92,.08); }
.ohg-stage-bg { position:absolute; inset:0; background-size:cover; background-position:center; transition:opacity .3s; }
.ohg-pin { position:absolute; width:32px; height:32px; border-radius:50%; background:#fff; color:#F97316; border:3px solid #F97316; cursor:pointer; display:grid; place-items:center; font-size:18px; font-weight:900; box-shadow:0 4px 14px rgba(0,0,0,.25); transform:translate(-50%,-50%); transition:transform .15s; z-index:5; animation:ohg-pulse 2.4s ease-in-out infinite; }
.ohg-pin:hover, .ohg-pin.on { transform:translate(-50%,-50%) scale(1.18); background:#F97316; color:#fff; animation:none; }
@keyframes ohg-pulse { 0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.25),0 0 0 0 rgba(249,115,22,.5);} 50%{box-shadow:0 4px 14px rgba(0,0,0,.25),0 0 0 10px rgba(249,115,22,0);} }
.ohg-card { position:absolute; left:50%; bottom:18px; transform:translateX(-50%) translateY(120%); width:calc(100% - 36px); max-width:380px; background:rgba(255,255,255,.98); border-radius:14px; box-shadow:0 12px 36px rgba(0,0,0,.18); padding:12px; display:flex; gap:12px; align-items:center; cursor:pointer; transition:transform .35s cubic-bezier(.4,0,.2,1); z-index:10; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
.ohg-card.on { transform:translateX(-50%) translateY(0); }
.ohg-card .pc-img { width:64px; height:64px; flex-shrink:0; border-radius:8px; background-size:cover; background-position:center; background-color:#F3F4F6; }
.ohg-card .pc-info { flex:1; min-width:0; }
.ohg-card .pc-brand { font-size:11px; color:#9CA3AF; font-weight:700; margin-bottom:2px; }
.ohg-card .pc-name { font-size:13px; color:#111827; font-weight:600; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:4px; }
.ohg-card .pc-price { font-size:14px; color:#111827; font-weight:900; }
.ohg-card .pc-arrow { width:28px; height:28px; flex-shrink:0; display:grid; place-items:center; color:#9CA3AF; font-size:22px; }
.ohg-bookmark { position:absolute; right:14px; bottom:14px; width:38px; height:38px; background:rgba(255,255,255,.95); border:0; border-radius:10px; cursor:pointer; display:grid; place-items:center; z-index:6; box-shadow:0 2px 8px rgba(0,0,0,.15); }
.ohg-bookmark svg { width:18px; height:18px; fill:none; stroke:#374151; stroke-width:2; }
.ohg-bookmark.on svg { fill:#F97316; stroke:#F97316; }
.ohg-thumbs { display:flex; gap:8px; margin-top:14px; overflow-x:auto; padding:2px 0; }
.ohg-thumb { flex-shrink:0; width:96px; height:96px; border-radius:10px; overflow:hidden; cursor:pointer; border:3px solid transparent; background-size:cover; background-position:center; background-color:#F3F4F6; transition:border-color .15s; }
.ohg-thumb.on { border-color:#F97316; }
.ohg-help { font-size:12px; color:#6B7280; margin-top:14px; padding:10px 14px; background:#FFF7ED; border:1px dashed #FED7AA; border-radius:10px; display:flex; align-items:center; gap:8px; }
.ohg-help .ic { width:22px; height:22px; border-radius:50%; background:#F97316; color:#fff; display:grid; place-items:center; font-size:14px; font-weight:900; flex-shrink:0; }
@media(max-width:640px){ .ohg{ padding:0 16px 20px; } .ohg-thumb{ width:74px; height:74px; } .ohg-card{ width:calc(100% - 28px); } }
</style>
<section class="ohg">
  <div class="ohg-stage" id="ohgStage">
    <div class="ohg-stage-bg" id="ohgBg"></div>
    <button class="ohg-bookmark" id="ohgBm" aria-label="스크랩"><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
    <div class="ohg-card" id="ohgCard">
      <div class="pc-img" id="ohgPcImg"></div>
      <div class="pc-info">
        <div class="pc-brand" id="ohgPcBrand"></div>
        <div class="pc-name" id="ohgPcName"></div>
        <div class="pc-price" id="ohgPcPrice"></div>
      </div>
      <span class="pc-arrow">›</span>
    </div>
  </div>
  <div class="ohg-thumbs" id="ohgThumbs"></div>
  <div class="ohg-help"><span class="ic">+</span><span>사진 위 <b>+</b> 마커를 누르면 사용된 상품을 바로 확인할 수 있어요.</span></div>
</section>
<script>
(function(){
  // 데모용 — 실제 운영 시 자사몰 상품 DB와 연동
  var products = {
    p1: { brand:'아트포스터', name:'모네 — 베테유의 화가 정원 액자 (60×80)', price:'89,000원', img:'https://picsum.photos/seed/oh-art/200', url:'#' },
    p2: { brand:'그린홈', name:'아레카 야자 화분 — 중형 80cm 스탠드 포함', price:'45,000원', img:'https://picsum.photos/seed/oh-plant/200', url:'#' },
    p3: { brand:'미러로프트', name:'아치형 풀렝스 미러 — 그린 우드프레임 50×170', price:'168,000원', img:'https://picsum.photos/seed/oh-mirror/200', url:'#' },
    p4: { brand:'가구로드', name:'발코니 식탁 원목 의자 인테리어 카페 체어 2colors', price:'85,000원', img:'https://picsum.photos/seed/oh-chair/200', url:'#' },
    p5: { brand:'리빙클래식', name:'유리 사이드 테이블 — 스테인리스 골드 트레이형', price:'124,000원', img:'https://picsum.photos/seed/oh-table/200', url:'#' },
    p6: { brand:'무드플로어', name:'헤링본 강마루 — 화이트 오크 (1평 패키지)', price:'72,000원', img:'https://picsum.photos/seed/oh-floor/200', url:'#' },
    p7: { brand:'세라믹랩', name:'무광 세라믹 화분 받침 세트 (3종)', price:'29,000원', img:'https://picsum.photos/seed/oh-pot/200', url:'#' },
    p8: { brand:'노드아트', name:'미니 조각상 오브제 — 화이트 무광', price:'38,000원', img:'https://picsum.photos/seed/oh-deco/200', url:'#' },
  };
  var photos = [
    { id:1, src:'https://picsum.photos/seed/oh-living-1/1200/900', pins:[
      { x:18, y:46, product:'p1' }, { x:30, y:62, product:'p2' }, { x:46, y:38, product:'p3' }, { x:55, y:68, product:'p4' }
    ]},
    { id:2, src:'https://picsum.photos/seed/oh-living-2/1200/900', pins:[
      { x:35, y:42, product:'p5' }, { x:60, y:55, product:'p3' }
    ]},
    { id:3, src:'https://picsum.photos/seed/oh-living-3/1200/900', pins:[
      { x:25, y:50, product:'p6' }, { x:55, y:45, product:'p7' }, { x:72, y:60, product:'p8' }
    ]},
    { id:4, src:'https://picsum.photos/seed/oh-living-4/1200/900', pins:[
      { x:40, y:38, product:'p4' }, { x:60, y:55, product:'p1' }
    ]},
    { id:5, src:'https://picsum.photos/seed/oh-living-5/1200/900', pins:[
      { x:30, y:55, product:'p2' }, { x:55, y:45, product:'p4' }, { x:72, y:60, product:'p5' }
    ]},
  ];
  var currentPhoto = 0;
  var currentProduct = null;
  function $(id){ return document.getElementById(id); }
  function renderPhoto(){
    var p = photos[currentPhoto];
    $('ohgBg').style.backgroundImage = "url('" + p.src + "')";
    var stage = $('ohgStage');
    stage.querySelectorAll('.ohg-pin').forEach(function(el){ el.remove(); });
    p.pins.forEach(function(pin){
      var btn = document.createElement('button');
      btn.className = 'ohg-pin';
      btn.style.left = pin.x + '%';
      btn.style.top = pin.y + '%';
      btn.textContent = '+';
      btn.setAttribute('aria-label', '상품 보기');
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        showProduct(pin.product, btn);
      });
      stage.appendChild(btn);
    });
    document.querySelectorAll('.ohg-thumb').forEach(function(t,i){ t.classList.toggle('on', i===currentPhoto); });
    hideCard();
  }
  function showProduct(pid, pinEl){
    var pr = products[pid];
    if (!pr) return;
    $('ohgPcImg').style.backgroundImage = "url('" + pr.img + "')";
    $('ohgPcBrand').textContent = pr.brand;
    $('ohgPcName').textContent = pr.name;
    $('ohgPcPrice').textContent = pr.price;
    $('ohgCard').classList.add('on');
    document.querySelectorAll('.ohg-pin.on').forEach(function(el){ el.classList.remove('on'); });
    if (pinEl) pinEl.classList.add('on');
    currentProduct = pid;
    var card = $('ohgCard');
    card.onclick = function(){ window.open(pr.url || '#', '_blank'); };
  }
  function hideCard(){ $('ohgCard').classList.remove('on'); currentProduct = null; document.querySelectorAll('.ohg-pin.on').forEach(function(el){ el.classList.remove('on'); }); }
  function renderThumbs(){
    var wrap = $('ohgThumbs');
    wrap.innerHTML = '';
    photos.forEach(function(p, i){
      var t = document.createElement('button');
      t.className = 'ohg-thumb' + (i===0 ? ' on' : '');
      t.style.backgroundImage = "url('" + p.src + "')";
      t.setAttribute('aria-label', '사진 ' + (i+1));
      t.addEventListener('click', function(){ currentPhoto = i; renderPhoto(); });
      wrap.appendChild(t);
    });
  }
  $('ohgStage').addEventListener('click', function(e){
    if (!e.target.closest('.ohg-pin') && !e.target.closest('.ohg-card')) hideCard();
  });
  $('ohgBm').addEventListener('click', function(e){
    e.stopPropagation();
    e.currentTarget.classList.toggle('on');
  });
  renderThumbs();
  renderPhoto();
})();
</script>`;

  const SEED_OH_BODY_HTML = `
<style>
.ohb * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.ohb { max-width:760px; margin:0 auto; padding:24px 22px; }
.ohb-p { font-size:15.5px; line-height:1.85; color:#374151; margin-bottom:22px; word-break:keep-all; }
.ohb-p b { color:#0F1F5C; font-weight:800; }
.ohb-quote { padding:18px 22px; background:#FFF7ED; border-left:4px solid #F97316; border-radius:0 10px 10px 0; margin:22px 0; font-size:14.5px; line-height:1.75; color:#7C2D12; font-weight:600; font-style:italic; }
.ohb-img { width:100%; border-radius:14px; margin:22px 0; box-shadow:0 4px 18px rgba(15,31,92,.08); display:block; }
.ohb-h2 { font-size:19px; font-weight:900; color:#0F1F5C; margin:28px 0 12px; padding-left:12px; border-left:4px solid #F97316; line-height:1.4; }
.ohb-tip { display:flex; gap:12px; padding:14px 16px; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:12px; margin:18px 0; }
.ohb-tip .ic { width:28px; height:28px; flex-shrink:0; background:#10B981; color:#fff; border-radius:50%; display:grid; place-items:center; font-size:14px; font-weight:900; }
.ohb-tip .tx { flex:1; font-size:13.5px; line-height:1.65; color:#065F46; font-weight:600; }
.ohb-tip .tx b { color:#047857; }
@media(max-width:640px){ .ohb{ padding:18px 16px; } .ohb-p{ font-size:14.5px; } .ohb-h2{ font-size:17px; } }
</style>
<section class="ohb">
  <p class="ohb-p">이사 온 지 두 달, <b>거실 한 면을 어떻게 채울지</b> 한참을 고민했어요. 큰 가구를 채워 넣기보다, 좋아하는 그림 하나로 공간의 분위기를 정하고 싶었거든요.</p>
  <p class="ohb-p">그래서 선택한 게 <b>모네의 '베테유의 화가 정원'</b>. 따뜻한 노란 톤이 거실 우드 가구와 자연스럽게 어우러져요. 액자만 두는 게 너무 단조로울까 봐 옆에 키 큰 야자수 화분도 함께 두었습니다.</p>
  <div class="ohb-quote">"가구를 줄이고 그림 하나, 식물 하나로 비우니 오히려 거실이 넓어 보여요."</div>
  <h2 class="ohb-h2">아치형 미러로 공간감 더하기</h2>
  <p class="ohb-p">맞은편 벽엔 풀렝스 미러를 세웠어요. 빛이 반사되면서 거실이 한 배쯤 넓어 보이는 효과가 있어요. 그린 우드 프레임이 야자수와 톤이 맞아서 자연스럽게 묶여요.</p>
  <img class="ohb-img" src="https://picsum.photos/seed/oh-detail-1/1200/700" alt="거실 디테일"/>
  <h2 class="ohb-h2">발코니 카페 체어 — 가장 좋아하는 자리</h2>
  <p class="ohb-p">모닝 커피 마시는 자리예요. <b>원목 카페 체어 두 개</b>를 두고 작은 사이드 테이블 하나만 놓았어요. 비워둔 게 오히려 편안해요.</p>
  <div class="ohb-tip"><div class="ic">💡</div><div class="tx"><b>POUR스토어 TIP</b> — 작은 공간일수록 가구를 줄이고 <b>한두 점의 포인트 오브제</b>로 분위기를 잡아보세요. 비워둔 만큼 시선이 머무를 곳이 생깁니다.</div></div>
</section>`;

  const SEED_OH_PRODUCTS_HTML = `
<style>
.ohp * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.ohp { max-width:760px; margin:0 auto; padding:24px 22px; }
.ohp-h { font-size:18px; font-weight:900; color:#0F1F5C; margin-bottom:14px; display:flex; align-items:center; gap:10px; }
.ohp-h .ic { width:28px; height:28px; background:#F97316; color:#fff; border-radius:50%; display:grid; place-items:center; font-size:14px; font-weight:900; }
.ohp-h .cnt { font-size:13px; color:#9CA3AF; font-weight:600; margin-left:4px; }
.ohp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; }
.ohp-card { background:#fff; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; cursor:pointer; transition:transform .15s, box-shadow .15s; }
.ohp-card:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(15,31,92,.10); border-color:#FED7AA; }
.ohp-img { width:100%; aspect-ratio:1/1; background-size:cover; background-position:center; background-color:#F3F4F6; }
.ohp-info { padding:10px 12px 12px; }
.ohp-brand { font-size:11px; color:#9CA3AF; font-weight:700; margin-bottom:3px; }
.ohp-name { font-size:12.5px; color:#111827; font-weight:600; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:6px; min-height:35px; }
.ohp-price { font-size:14px; color:#111827; font-weight:900; }
.ohp-tag { display:inline-block; font-size:10px; padding:2px 6px; background:#FFEDD5; color:#EA580C; border-radius:4px; font-weight:800; margin-top:4px; }
@media(max-width:640px){ .ohp{ padding:20px 16px; } .ohp-grid{ grid-template-columns:repeat(2,1fr); } }
</style>
<section class="ohp">
  <h3 class="ohp-h"><span class="ic">🏷</span>이 포스트에 사용된 상품<span class="cnt">8개</span></h3>
  <div class="ohp-grid">
    <a class="ohp-card"><div class="ohp-img" style="background-image:url('https://picsum.photos/seed/oh-art/400')"></div><div class="ohp-info"><div class="ohp-brand">아트포스터</div><div class="ohp-name">모네 — 베테유의 화가 정원 액자 (60×80)</div><div class="ohp-price">89,000원</div></div></a>
    <a class="ohp-card"><div class="ohp-img" style="background-image:url('https://picsum.photos/seed/oh-plant/400')"></div><div class="ohp-info"><div class="ohp-brand">그린홈</div><div class="ohp-name">아레카 야자 화분 — 중형 80cm</div><div class="ohp-price">45,000원</div></div></a>
    <a class="ohp-card"><div class="ohp-img" style="background-image:url('https://picsum.photos/seed/oh-mirror/400')"></div><div class="ohp-info"><div class="ohp-brand">미러로프트</div><div class="ohp-name">아치형 풀렝스 미러 — 그린 우드프레임</div><div class="ohp-price">168,000원</div></div></a>
    <a class="ohp-card"><div class="ohp-img" style="background-image:url('https://picsum.photos/seed/oh-chair/400')"></div><div class="ohp-info"><div class="ohp-brand">가구로드</div><div class="ohp-name">발코니 식탁 원목 의자 카페 체어 2colors</div><div class="ohp-price">85,000원</div><span class="ohp-tag">인기</span></div></a>
    <a class="ohp-card"><div class="ohp-img" style="background-image:url('https://picsum.photos/seed/oh-table/400')"></div><div class="ohp-info"><div class="ohp-brand">리빙클래식</div><div class="ohp-name">유리 사이드 테이블 골드 트레이</div><div class="ohp-price">124,000원</div></div></a>
    <a class="ohp-card"><div class="ohp-img" style="background-image:url('https://picsum.photos/seed/oh-floor/400')"></div><div class="ohp-info"><div class="ohp-brand">무드플로어</div><div class="ohp-name">헤링본 강마루 — 화이트 오크 (1평)</div><div class="ohp-price">72,000원</div></div></a>
    <a class="ohp-card"><div class="ohp-img" style="background-image:url('https://picsum.photos/seed/oh-pot/400')"></div><div class="ohp-info"><div class="ohp-brand">세라믹랩</div><div class="ohp-name">무광 세라믹 화분 받침 세트 (3종)</div><div class="ohp-price">29,000원</div></div></a>
    <a class="ohp-card"><div class="ohp-img" style="background-image:url('https://picsum.photos/seed/oh-deco/400')"></div><div class="ohp-info"><div class="ohp-brand">노드아트</div><div class="ohp-name">미니 조각상 오브제 — 화이트 무광</div><div class="ohp-price">38,000원</div></div></a>
  </div>
</section>`;

  const SEED_OH_COMMENTS_HTML = `
<style>
.ohc * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.ohc { max-width:760px; margin:0 auto; padding:24px 22px 40px; }
.ohc-actions { display:flex; gap:10px; padding:14px 0 18px; border-bottom:1px solid #E5E7EB; margin-bottom:24px; }
.ohc-act { flex:1; padding:12px 0; background:#fff; border:1.5px solid #E5E7EB; border-radius:10px; font-size:13px; font-weight:700; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
.ohc-act:hover { border-color:#F97316; color:#EA580C; }
.ohc-act.on { background:#FFF7ED; border-color:#F97316; color:#EA580C; }
.ohc-act svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; }
.ohc-h { font-size:17px; font-weight:900; color:#0F1F5C; margin-bottom:14px; }
.ohc-h .cnt { color:#F97316; }
.ohc-input { display:flex; gap:10px; padding:12px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px; margin-bottom:18px; }
.ohc-input .av { width:36px; height:36px; flex-shrink:0; border-radius:50%; background:linear-gradient(135deg,#9CA3AF,#6B7280); color:#fff; display:grid; place-items:center; font-size:13px; font-weight:800; }
.ohc-input input { flex:1; border:0; background:transparent; outline:none; font-size:13.5px; color:#111827; padding:8px 0; }
.ohc-input button { padding:8px 16px; background:#F97316; color:#fff; border:0; border-radius:8px; font-size:12.5px; font-weight:800; cursor:pointer; }
.ohc-list { display:flex; flex-direction:column; gap:18px; margin-bottom:32px; }
.ohc-item { display:flex; gap:12px; }
.ohc-item .av { width:36px; height:36px; flex-shrink:0; border-radius:50%; color:#fff; display:grid; place-items:center; font-size:13px; font-weight:800; }
.ohc-item .body { flex:1; min-width:0; }
.ohc-item .nm { font-size:13px; font-weight:800; color:#111827; margin-bottom:4px; display:flex; align-items:center; gap:6px; }
.ohc-item .nm .tm { font-size:11px; color:#9CA3AF; font-weight:600; }
.ohc-item .tx { font-size:13.5px; color:#374151; line-height:1.6; }
.ohc-item .reply { font-size:11.5px; color:#9CA3AF; font-weight:700; margin-top:6px; cursor:pointer; }
.ohc-item .reply:hover { color:#F97316; }
.ohc-rel-h { font-size:17px; font-weight:900; color:#0F1F5C; margin-bottom:14px; padding-top:24px; border-top:1px solid #E5E7EB; }
.ohc-rel { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
.ohc-rel-card { background:#fff; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; cursor:pointer; transition:transform .15s, box-shadow .15s; }
.ohc-rel-card:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(15,31,92,.10); }
.ohc-rel-img { width:100%; aspect-ratio:4/3; background-size:cover; background-position:center; background-color:#F3F4F6; }
.ohc-rel-info { padding:10px 12px 12px; }
.ohc-rel-cat { font-size:10.5px; color:#EA580C; font-weight:800; margin-bottom:3px; }
.ohc-rel-t { font-size:13px; font-weight:700; color:#111827; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:6px; }
.ohc-rel-meta { font-size:11px; color:#9CA3AF; }
@media(max-width:640px){ .ohc{ padding:20px 16px 30px; } .ohc-rel{ grid-template-columns:repeat(2,1fr); } }
</style>
<section class="ohc">
  <div class="ohc-actions">
    <button class="ohc-act on"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>좋아요 284</button>
    <button class="ohc-act"><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>스크랩 156</button>
    <button class="ohc-act"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>공유</button>
  </div>
  <h3 class="ohc-h">댓글 <span class="cnt">42</span></h3>
  <div class="ohc-input">
    <div class="av">나</div>
    <input type="text" placeholder="응원의 댓글을 남겨주세요" />
    <button>등록</button>
  </div>
  <div class="ohc-list">
    <div class="ohc-item">
      <div class="av" style="background:linear-gradient(135deg,#F97316,#EA580C)">서</div>
      <div class="body">
        <div class="nm">서연맘 <span class="tm">3시간 전</span></div>
        <div class="tx">미러 위치 정보 너무 좋네요! 저희 집도 작은데 한번 따라해 보고 싶어요. 혹시 미러 높이가 어떻게 되나요?</div>
        <div class="reply">↳ 답글 달기</div>
      </div>
    </div>
    <div class="ohc-item">
      <div class="av" style="background:linear-gradient(135deg,#10B981,#059669)">하</div>
      <div class="body">
        <div class="nm">하루의집 <span class="tm">5시간 전</span></div>
        <div class="tx">모네 액자가 분위기 정말 살리네요 ✨ 저도 비워둔 인테리어 도전해보고 싶어요</div>
        <div class="reply">↳ 답글 달기</div>
      </div>
    </div>
    <div class="ohc-item">
      <div class="av" style="background:linear-gradient(135deg,#7C3AED,#6D28D9)">민</div>
      <div class="body">
        <div class="nm">민지의집 <span class="tm">4시간 전</span> · <span style="color:#EA580C; font-weight:800">에디터</span></div>
        <div class="tx">@서연맘 미러는 50×170 사이즈예요! 천장 닿지 않는 정도라 답답하지 않더라구요 :)</div>
        <div class="reply">↳ 답글 달기</div>
      </div>
    </div>
  </div>
  <h3 class="ohc-rel-h">이 포스트와 어울리는 다른 집들이</h3>
  <div class="ohc-rel">
    <a class="ohc-rel-card"><div class="ohc-rel-img" style="background-image:url('https://picsum.photos/seed/oh-rel-1/400/300')"></div><div class="ohc-rel-info"><div class="ohc-rel-cat">미니멀 인테리어</div><div class="ohc-rel-t">25평 신혼집 — 비움의 미학으로 채운 거실</div><div class="ohc-rel-meta">조회 5.2k · ❤ 412</div></div></a>
    <a class="ohc-rel-card"><div class="ohc-rel-img" style="background-image:url('https://picsum.photos/seed/oh-rel-2/400/300')"></div><div class="ohc-rel-info"><div class="ohc-rel-cat">홈데코</div><div class="ohc-rel-t">액자 한 점으로 바꾸는 거실 분위기 6가지</div><div class="ohc-rel-meta">조회 8.1k · ❤ 623</div></div></a>
    <a class="ohc-rel-card"><div class="ohc-rel-img" style="background-image:url('https://picsum.photos/seed/oh-rel-3/400/300')"></div><div class="ohc-rel-info"><div class="ohc-rel-cat">식물 인테리어</div><div class="ohc-rel-t">초보자도 키우기 쉬운 거실 화분 8선</div><div class="ohc-rel-meta">조회 12k · ❤ 891</div></div></a>
    <a class="ohc-rel-card"><div class="ohc-rel-img" style="background-image:url('https://picsum.photos/seed/oh-rel-4/400/300')"></div><div class="ohc-rel-info"><div class="ohc-rel-cat">셀프 리모델링</div><div class="ohc-rel-t">헤링본 강마루 직접 시공 — 비용·후기</div><div class="ohc-rel-meta">조회 6.8k · ❤ 524</div></div></a>
  </div>
</section>`;


  const DEFAULT_PAGES = () => ([
    { id: 'main', name: '메인 페이지', file: 'index.html', sections: [
      mkSec('메인 배너', SEED_BANNER_HTML, '라이트 크림 + 오렌지 그라디언트 — 가벼운 톤 (v3)', 'wip'),
      mkSec('카테고리 항목 버튼', SEED_CATEGORY_HTML, 'SVG 아이콘 + 라이트 카드 + 호버 회전 (v3)', 'wip'),
      mkSec('AI 맞춤 자재추천', SEED_AI_RECOMMEND_HTML, 'POUR 길잡이 — 자동완성 카테고리 그룹화(지붕·외벽·지하), 카드 컴팩트 (v9)', 'wip'),
      mkSec('인기 추천 상품', SEED_POPULAR_HTML, '라이트 카드 + 별점·리뷰수 — 매거진 톤 일관 (v3)', 'wip'),
      mkSec('신상품 (안전용품·부자재)', SEED_NEW_ARRIVALS_HTML, '라이트 톤 + 입고일·할인가 (v3)', 'wip'),
      mkSec('서브카테고리 상품', SEED_SUBCATEGORY_HTML, 'DREAM COAT + GROHOME 풀-그라디언트 카드 + 호버 회전 (v2)', 'wip'),
      mkSec('유튜브 숏츠 연결', SEED_YOUTUBE_HTML, '라이트 톤 + 조회수·길이 + 호버 시 빨간 플레이 (v3)', 'wip'),
      mkSec('서비스 소개', SEED_SERVICE_HTML, '대리점·파트너사·전시장 — SVG 아이콘 + 컬러별 차별 (v2)', 'wip'),
      mkSec('자사몰 내 포스팅', SEED_POSTING_HTML, '매거진 레이아웃 (Cover Story 1+3) + 읽기시간·조회수 (v2)', 'wip'),
      mkSec('동영상 가이드', SEED_VIDEO_GUIDE_HTML, 'POUR스토어 자체 영상 — 추천 영상 + 미니 카드 매거진 레이아웃 (v2)', 'wip'),
      mkSec('POUR스토어 실적관', POUR_STATS_NATIVE_HTML, '네이티브 재구축 — 라이트 크림+오렌지 톤(형제 섹션 통일). 실적 수치 4종 + 전국 시공 현장 갤러리(19장). 기존 cafe24 iframe 대체.', 'requested'),
    ]},
    { id: 'pour-doctor', name: 'POUR닥터 (전용 페이지)', file: 'pour-doctor.html', sections: [
      mkSec('히어로 — 당신만의 건물 닥터', POUR_DR_HERO_HTML, '다크 네이비 + 라이브 진단 보드 + 5개 신뢰 수치 (의료·전문 톤)', 'wip'),
      mkSec('3단계 시공 프로세스', POUR_DR_PROCESS_HTML, '진단→처방→시공 매칭(선택) + 일반 쇼핑몰 비교표', 'wip'),
      mkSec('전문가 팀 + 빅데이터', POUR_DR_TRUST_HTML, 'R&D 박사·시공팀·AI 데이터팀 3카드 + 8개 핵심 수치 패널', 'wip'),
      mkSec('무료 진단 폼', POUR_DR_FORM_HTML, '건물유형·증상칩·메모·사진·연락처 — 3분 처방서 발송 CTA', 'wip'),
    ]},
    { id: 'about', name: '브랜드스토리 소개', file: 'about.html', sections: [
      mkSec('히어로 비주얼', SEED_AB_HERO_HTML, '라이트 크림 + 오렌지 + 4개 핵심 수치 (260만/250+/70+/110+)', 'wip'),
      mkSec('회사 소개', SEED_AB_ABOUT_HTML, '2-column 이미지+텍스트 — 설립 정보 인포 그리드 포함', 'wip'),
      mkSec('핵심 기술 / R&D', SEED_AB_RD_HTML, '6개 기술 카드 — 슈퍼복합압축시트·코트재·HOOKER·탄성강화·하이퍼티·페이퍼팬벤트', 'wip'),
      mkSec('인증·특허', SEED_AB_CERT_HTML, '건설신기술 1026호 피처 카드 + KTR/KCL/SGS/건축성능원/특허/ISO 6종', 'wip'),
      mkSec('연혁', SEED_AB_HISTORY_HTML, '타임라인 2018→2025 — 설립부터 자사몰 리뉴얼까지 6개 이정표', 'wip'),
      mkSec('하단 CTA', SEED_AB_CTA_HTML, '네이비 그라디언트 + 시공 상담/파트너/쇼룸 3개 버튼', 'wip'),
    ]},
    { id: 'products', name: '제품 소개', file: 'products.html', sections: [
      mkSec('부위별 패키지 네비', SEED_PR_NAV_HTML, '9개 부위 카드 (슬라브/슁글/기와/균열/재도장/칼라강판/배수로/주차장/이음부) + 라인 토글(아파트/저층) + HOT 배지', 'wip'),
      mkSec('패키지 등급 가이드', SEED_PR_TIER_HTML, '풀패키지(강력추천) / 부분 패키지 / 단순 코팅 3티어 — 각 카드에 시공 영상·코칭 표시', 'wip'),
      mkSec('베스트 패키지', SEED_PR_BEST_HTML, '4종 풀/부분 패키지 — 랭크·티어 배지 + 자재 조합 표시 + 셀프/시공연결 + 영상·PDF 인디케이터', 'wip'),
      mkSec('신규 패키지', SEED_PR_NEW_HTML, '4종 신규 패키지 — 이음부 풀/저층 균열/슁글 1026호 풀/결로방지 — 한정 할인 + 셀프·시공연결 + 영상·PDF', 'wip'),
      mkSec('전체 패키지 매트릭스', SEED_PR_GRID_HTML, '시안 매트릭스 그대로 — 라인(아파트/저층) × 부위 4그룹 × 등급 3티어, 부위별 셀프/시공연결 표시', 'wip'),
      mkSec('시공 가이드 (영상·코칭)', SEED_PR_GUIDE_HTML, '영상/코칭 2탭 — 피처 영상(슬라브 풀세트) + 미니 4 + 전화 코칭 안내 (시방서는 매거진으로 분리)', 'wip'),
    ]},
    { id: 'construction', name: '시공 사례', file: 'construction.html', sections: [
      mkSec('사례 인트로', SEED_CS_INTRO_HTML, '라이트 크림 + 4개 핵심 수치 (700+/260만/150만㎡/17개 광역시도)', 'wip'),
      mkSec('지역별 필터', SEED_CS_FILTER_HTML, '지역 칩 + 건물유형 칩 + 검색바 (15개 광역 + 6개 유형)', 'wip'),
      mkSec('사례 갤러리', SEED_CS_GALLERY_HTML, '12개 카드 — 지역·공법 태그 + 좋아요·완공일 표기', 'wip'),
      mkSec('공법별 사례', SEED_CS_BYMETHOD_HTML, '8개 공법 카드 — 슬라브/슁글/금속기와/외벽/에폭시/배면차수/아스콘/단면복구', 'wip'),
      mkSec('고객 후기', SEED_CS_REVIEW_HTML, '평균 만족도 4.9 + 6개 후기 카드 (관리소장·시설팀·입주자대표 등)', 'wip'),
    ]},
    { id: 'contact', name: '문의', file: 'contact.html', sections: [
      mkSec('문의 폼', SEED_CT_FORM_HTML, '4종 문의유형 칩 + 성함·연락처·이메일·건물유형·지역·내용 + 동의', 'wip'),
      mkSec('매장 정보', SEED_CT_STORE_HTML, '본사 정보 카드 (전화/시간/이메일/주소) + 평택 지도 미니뷰', 'wip'),
      mkSec('카카오톡 채널', SEED_CT_KAKAO_HTML, '카카오 옐로우 풀카드 — 응답 3분 + 채널 친구 4,800+', 'wip'),
      mkSec('FAQ', SEED_CT_FAQ_HTML, '6개 아코디언 (셀프시공/견적/지역/하자보증/파트너/B2B 단가)', 'wip'),
    ]},
    { id: 'partners', name: '파트너사 소개·신청', file: 'partners.html', sections: [
      mkSec('히어로 + 신청 CTA', SEED_PT_HERO_HTML, '라이트 크림 + 4개 파트너 수치 (250+/12,000+/94%/17 광역)', 'wip'),
      mkSec('파트너사 혜택', SEED_PT_BENEFIT_HTML, '6개 혜택 카드 (자재 직공급/일감 배정/교육/마케팅/하자분담/결제 안전)', 'wip'),
      mkSec('자격 요건', SEED_PT_REQ_HTML, '필수(오렌지 보더) + 우대(그린 보더) 2-column', 'wip'),
      mkSec('진행 절차', SEED_PT_FLOW_HTML, '5단계 플로우 — 신청→검토→실사→계약→시공 (14일)', 'wip'),
      mkSec('주요 파트너사 로고', SEED_PT_LOGOS_HTML, '12개 파트너사 카드 + 지역 표기', 'wip'),
      mkSec('파트너사 신청 폼', SEED_PT_FORM_HTML, '회사정보/담당자/시공분야/실적/첨부서류 풀폼', 'wip'),
      mkSec('자주 묻는 질문', SEED_PT_FAQ_HTML, '6개 아코디언 (가입비/등급/전속/일감/정산/교육)', 'wip'),
    ]},
    { id: 'dealers', name: '대리점·공급 문의', file: 'dealers.html', sections: [
      mkSec('히어로', SEED_DL_HERO_HTML, '라이트 크림 + 4개 수치 (42 대리점/평균 28%/98% 재계약/12 신규권역)', 'wip'),
      mkSec('대리점 혜택·마진 구조', SEED_DL_MARGIN_HTML, 'Silver 22% / Gold 28% (추천) / Platinum 35% 3-tier', 'wip'),
      mkSec('자격 요건', SEED_DL_REQ_HTML, '필수 + 우대 2-column (매장 33㎡ / 초도 1천만원)', 'wip'),
      mkSec('공급 가능 카테고리', SEED_DL_CAT_HTML, '8개 카테고리 카드 — 110+ SKU 라인업', 'wip'),
      mkSec('진행 절차', SEED_DL_FLOW_HTML, '5단계 (신청→권역→실사→계약→오픈, 21일)', 'wip'),
      mkSec('대리점 신청 폼', SEED_DL_FORM_HTML, '신청자/매장재고/사업정보 풀폼', 'wip'),
      mkSec('자주 묻는 질문', SEED_DL_FAQ_HTML, '6개 아코디언 (전속/재고/페인트/정산/해지/광고)', 'wip'),
    ]},
    { id: 'matching', name: '시공 연결 신청', file: 'matching.html', sections: [
      mkSec('히어로 + 진행 단계 미리보기', SEED_MT_HERO_HTML, '라이트 크림 + 5단계 플로우 미리보기 (3분→즉시→1-2일→3-5일→7-14일)', 'wip'),
      mkSec('시공 가능 공법', SEED_MT_METHOD_HTML, '8개 공법 카드 — 사례 수 + 보증 기간 표기', 'wip'),
      mkSec('신청 폼 (지역·건물유형·문제·예산)', SEED_MT_FORM_HTML, '5단계 폼 — 지역/건물/문제 칩(9개)/예산(5단계)/연락처', 'wip'),
      mkSec('매칭 절차', SEED_MT_FLOW_HTML, '7단계 상세 절차 — 신청→AI매칭→추천→진단→비교→계약→완공', 'wip'),
      mkSec('전국 시공 네트워크', SEED_MT_NETWORK_HTML, '한국 지도 + 지역별 핀 (서울 38/경기 52/대전 18/부산 32/제주 8) + 4개 수치', 'wip'),
      mkSec('최근 시공 사례', SEED_MT_RECENT_HTML, '최근 매칭 시공 4건 — 파트너사명·지역·완공일 표기', 'wip'),
      mkSec('고객 후기', SEED_MT_REVIEW_HTML, '평균 매칭 만족도 4.8 + 3개 후기 (파트너 매칭 정보 포함)', 'wip'),
    ]},
    { id: 'showroom', name: '전시장·쇼룸', file: 'showroom.html', sections: [
      mkSec('히어로', SEED_SH_HERO_HTML, '라이트 크림 + 110+ 제품 체험 강조 + 예약 CTA', 'wip'),
      mkSec('쇼룸 위치·약도', SEED_SH_LOCATION_HTML, '평택 본사 지도 + 자가용/대중교통/거리 정보', 'wip'),
      mkSec('운영 시간', SEED_SH_HOURS_HTML, '평일/토요일 운영 + 일요일/공휴일 CLOSED + 예약 안내', 'wip'),
      mkSec('쇼룸 둘러보기 (갤러리)', SEED_SH_TOUR_HTML, '메인홀 피처 + 6개 존 (옥상모형/외벽/주차장/제품/상담/R&D)', 'wip'),
      mkSec('전시 제품', SEED_SH_DISPLAY_HTML, '8개 핵심 자재 — 시연·체험 포인트 표기', 'wip'),
      mkSec('방문 예약 폼', SEED_SH_BOOK_HTML, '일정/목적 6종 칩/방문정보 풀폼', 'wip'),
      mkSec('찾아오시는 길', SEED_SH_DIRECT_HTML, '6개 교통수단 카드 (자가용/기차/버스/공항/주차/문의)', 'wip'),
    ]},
    { id: 'magazine', name: '스토어 매거진', file: 'magazine.html', sections: [
      mkSec('히어로 + 검색', SEED_MG_HERO_HTML, '검색바 + 인기 태그 칩 (옥상누수/외벽도장/균열보수/셀프시공/하이퍼티/아파트관리)', 'wip'),
      mkSec('콘텐츠 카테고리 탭', SEED_MG_TABS_HTML, '7개 탭 — 전체/시공방법/케이스/제품/영상/트렌드/셀프시공 + 카운트', 'wip'),
      mkSec('에디터 PICK', SEED_MG_PICK_HTML, 'Cover Story 1 + 미니 4 (시공/케이스/셀프/트렌드)', 'wip'),
      mkSec('이번 주 인기 시공 영상', SEED_MG_VIDEO_HTML, '4개 영상 카드 — #1~#4 랭크 + 조회수·시간', 'wip'),
      mkSec('시공 설명서 모음', SEED_MG_GUIDE_HTML, '6개 시방서 PDF 카드 — 다운로드 수 표기', 'wip'),
      mkSec('자사몰 포스팅 카드 그리드', SEED_MG_POSTING_HTML, '6개 포스팅 — 오늘의집 스타일 (에디터·읽기시간·좋아요)', 'wip'),
      mkSec('관련 상품 추천 (콘텐츠 → 상품 연결)', SEED_MG_RELATED_HTML, '컨텐츠 연관 5개 상품 — 콘텐츠 배너 + 상품 카드', 'wip'),
      mkSec('카테고리별 더보기', SEED_MG_MORE_HTML, '8개 카테고리 카드 — 시공/케이스/제품/셀프/트렌드/관리자/영상/R&D', 'wip'),
    ]},
    { id: 'dash-partner', name: '[대시보드] 파트너사', file: 'portal.html (partner view)', sections: [
      mkSec('로그인 화면', SEED_DPT_LOGIN_HTML, '전화번호 + PIN — 파트너·대리점 공통 (역할 자동 감지)', 'wip'),
      mkSec('상단 헤더', SEED_DPT_HEADER_HTML, '파트너 회사명·등급(A/B/C)·연락처·로그아웃', 'wip'),
      mkSec('요약 4카드', SEED_DPT_SUMMARY_HTML, '대기 / 시공중 / 완료 / 누적 배정 (완료 그린 강조)', 'wip'),
      mkSec('배정된 시공연결 신청', SEED_DPT_LIST_HTML, '리스트 카드 — 상태·고객·지역·건물·시간·요약', 'wip'),
      mkSec('신청 상세 모달', SEED_DPT_DETAIL_HTML, '고객 정보 + 상태 업데이트 + 파트너 메모', 'wip'),
    ]},
    { id: 'dash-dealer', name: '[대시보드] 대리점주', file: 'portal.html (dealer view)', sections: [
      mkSec('로그인 화면', SEED_DLR_LOGIN_HTML, '전화번호 + PIN (파트너 화면과 동일)', 'wip'),
      mkSec('상단 헤더', SEED_DLR_HEADER_HTML, '대리점명·티어 배지(Silver/Gold/Platinum)·연락처·로그아웃', 'wip'),
      mkSec('핵심 CTA + 이달 요약', SEED_DLR_CTA_HTML, '+ 새 주문 작성 빅버튼 + 주문수/매출/예상 수수료(28% 강조)', 'wip'),
      mkSec('정산 안내 박스', SEED_DLR_SETTLE_HTML, '월말 자동 정산 안내 (그린 박스)', 'wip'),
      mkSec('최근 주문 테이블', SEED_DLR_ORDERS_HTML, '상태·주문번호·주문일·고객·품목·매출·수수료 (자동 계산)', 'wip'),
      mkSec('새 주문 모달', SEED_DLR_NEW_HTML, '결제 안내 + 고객정보 + 품목 다중 추가 + 합계·수수료 미리보기', 'wip'),
    ]},
    { id: 'posting-ohouse', name: '포스팅 상세 (오하우스 스타일)', file: 'posting.html', parentHint: '자사몰', sections: [
      mkSec('포스팅 헤더', SEED_OH_HEAD_HTML, '카테고리·제목·작성자·메타·조회/좋아요/스크랩 (v1)', 'wip'),
      mkSec('인터랙티브 사진 + 상품 핀', SEED_OH_GALLERY_HTML, '오하우스 스타일 — 사진 위 + 핀 클릭 → 상품 카드 슬라이드, 5장 사진 썸네일 네비 (v1)', 'wip'),
      mkSec('본문 콘텐츠', SEED_OH_BODY_HTML, '스토리 텍스트 + 인용 + 디테일 사진 + POUR스토어 TIP 박스 (v1)', 'wip'),
      mkSec('사용된 상품 모음', SEED_OH_PRODUCTS_HTML, '8개 상품 그리드 — 브랜드·이름·가격 카드 (v1)', 'wip'),
      mkSec('댓글 + 관련 포스팅', SEED_OH_COMMENTS_HTML, '좋아요/스크랩/공유 액션 + 3개 댓글 + 4개 관련 포스팅 (v1)', 'wip'),
    ]},
    { id: 'dash-kiosk', name: '[대시보드] 매장 키오스크 (고객용)', file: 'kiosk.html', sections: [
      mkSec('초기 설정 (대리점 바인딩)', SEED_KSK_SETUP_HTML, '대리점 전화번호 + PIN로 키오스크 바인딩 (30일 유지)', 'wip'),
      mkSec('환영 화면 (대기)', SEED_KSK_WELCOME_HTML, '큰 펄스 아이콘 + 환영 메시지 + 신뢰 트리오(R&D/영상/시공실적)', 'wip'),
      mkSec('주문 표시 (실시간)', SEED_KSK_DISPLAY_HTML, '좌: 품목 리스트 + 다크 네이비 총액 / 우: QR 결제 안내', 'wip'),
      mkSec('결제 완료 화면', SEED_KSK_PAID_HTML, '그린 그라디언트 + ✅ 펄스 + 주문번호 표시 (60초 후 환영 복귀)', 'wip'),
    ]},
  ]);

  function genId() { return 'id-' + Math.random().toString(36).slice(2, 10); }
  function mkSec(name, html, note, status) {
    const now = status ? new Date().toISOString() : null;
    return {
      id: genId(),
      name,
      html: html || '',
      note: note || '',
      status: status || null,   // null(초안) | 'requested' | 'approved' | 'revision'
      statusAt: now,
      // 하위 호환용
      confirmed: status === 'approved',
      confirmedAt: status === 'approved' ? now : null,
    };
  }
  const STATUS_META = {
    wip:       { label: '작업중',     icon: '⚙', color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD' },
    requested: { label: '컨펌 요청',   icon: '✋', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
    approved:  { label: '승인 완료',   icon: '✅', color: '#047857', bg: '#D1FAE5', border: '#6EE7B7' },
    revision:  { label: '재수정 요청', icon: '↻', color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' },
  };
  function statusLabel(s) { return s && STATUS_META[s] ? STATUS_META[s].label : '초안'; }
  function nowIso() { return new Date().toISOString(); }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // -------- state --------
  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.pages)) {
          const m = migrate(parsed);
          addMissingDefaultPages(m); // 신규 기본 페이지 자동 추가
          return m;
        }
      }
      // v1 → v2 자동 이관
      const v1raw = localStorage.getItem(STORAGE_KEY_V1);
      if (v1raw) {
        const v1 = JSON.parse(v1raw);
        if (v1 && Array.isArray(v1.pages)) {
          const migrated = migrate(v1);
          mergeDefaultSeeds(migrated);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
      return migrate(freshState());
    } catch (e) {
      console.error('[builder] loadState 실패:', e);
      return migrate(freshState());
    }
  }
  function addMissingDefaultPages(s) {
    // 사용자가 명시적으로 삭제한 페이지는 다시 추가하지 않음 (deletedDefaults 추적)
    s.deletedDefaults = s.deletedDefaults || [];
    const defaults = DEFAULT_PAGES();
    let added = 0;
    defaults.forEach(dp => {
      const exists = s.pages.some(p => p.id === dp.id);
      const wasDeleted = s.deletedDefaults.indexOf(dp.id) !== -1;
      if (exists || wasDeleted) return;
      // parentHint가 있으면 동일 이름의 폴더 아래에 자동 배치
      const newPage = Object.assign({}, dp);
      if (dp.parentHint) {
        const folder = s.pages.find(p => p.type === 'folder' && p.name === dp.parentHint);
        if (folder) newPage.parentId = folder.id;
        delete newPage.parentHint; // 영구 저장 시엔 hint 제거
      }
      s.pages.push(newPage);
      added++;
    });
    return added;
  }
  function freshState() {
    return { pages: DEFAULT_PAGES(), history: {}, activePageId: 'main' };
  }
  function migrate(s) {
    s.history = s.history || {};
    s.activePageId = s.activePageId || (s.pages[0] && s.pages[0].id);
    s.staff = Array.isArray(s.staff) ? s.staff : [];
    s.staff.forEach((st, i) => {
      if (!st.id) st.id = 'st-' + Math.random().toString(36).slice(2, 8);
      if (!st.color) st.color = STAFF_COLORS[i % STAFF_COLORS.length];
      if (st.role === undefined) st.role = '';
    });
    s.trash = s.trash && typeof s.trash === 'object' ? s.trash : {};
    s.trash.feedbacks = Array.isArray(s.trash.feedbacks) ? s.trash.feedbacks : [];
    // 폰트 시스템 컨펌 워크플로우 (섹션 단위와 동일 패턴)
    if (!s.fontSystem || typeof s.fontSystem !== 'object') {
      s.fontSystem = { status: null, statusAt: null, statusBy: null, statusByName: null, note: '', history: [] };
    }
    if (typeof s.fontSystem.note !== 'string') s.fontSystem.note = '';
    if (!Array.isArray(s.fontSystem.history)) s.fontSystem.history = [];
    // 폰트 토큰 — 역할별 일괄 적용 (없으면 기본 4종 시드)
    if (!Array.isArray(s.fontTokens)) s.fontTokens = DEFAULT_FONT_TOKENS();
    s.fontTokens.forEach((t, i) => {
      if (!t.id) t.id = 'ft-' + Math.random().toString(36).slice(2, 8);
      if (typeof t.key !== 'string') t.key = '역할' + (i + 1);
      if (typeof t.label !== 'string') t.label = t.key;
      if (typeof t.fontFamily !== 'string') t.fontFamily = "'Noto Sans KR', sans-serif";
      if (typeof t.fontSize !== 'string') t.fontSize = '15px';
      if (typeof t.fontWeight !== 'string') t.fontWeight = '400';
      if (typeof t.color !== 'string') t.color = '#111827';
      if (typeof t.lineHeight !== 'string') t.lineHeight = '1.6';
      if (typeof t.letterSpacing !== 'string') t.letterSpacing = '0';
    });
    // 상세페이지 템플릿 (Step A)
    s.templates = Array.isArray(s.templates) ? s.templates : [];
    s.templates.forEach(t => {
      if (!t.id) t.id = 'tpl-' + Math.random().toString(36).slice(2, 8);
      if (!Array.isArray(t.slots)) t.slots = [];
      if (typeof t.html !== 'string') t.html = '';
      if (typeof t.name !== 'string') t.name = '(이름 없음)';
      if (typeof t.description !== 'string') t.description = '';
    });
    s.pages.forEach(p => {
      // 폴더 계층 (Step 2)
      if (p.parentId === undefined) p.parentId = null;
      if (!p.type) p.type = 'page'; // 기존 데이터는 모두 page
      p.sections = p.sections || [];
      p.feedbacks = Array.isArray(p.feedbacks) ? p.feedbacks : [];
      // 폴더는 sections/file 의미 없음 — 안전하게 빈값 유지
      if (p.type === 'folder') { p.sections = []; p.file = ''; }
      p.sections.forEach(sec => {
        if (typeof sec.confirmed !== 'boolean') sec.confirmed = false;
        if (sec.confirmedAt === undefined) sec.confirmedAt = null;
        if (sec.note === undefined) sec.note = '';
        sec.feedbacks = Array.isArray(sec.feedbacks) ? sec.feedbacks : [];
        // 컨펌 워크플로우 — 기존 confirmed 플래그를 status로 승격
        if (sec.status === undefined) {
          sec.status = sec.confirmed ? 'approved' : null;
          sec.statusAt = sec.confirmedAt || null;
        }
      });
    });
    Object.keys(s.history).forEach(k => {
      const list = s.history[k];
      if (!Array.isArray(list)) { delete s.history[k]; return; }
      list.forEach(v => { if (v.reason === undefined) v.reason = ''; });
    });
    s.migrations = (s.migrations && typeof s.migrations === 'object') ? s.migrations : {};
    // 1회성 마이그레이션 — 폰트 토큰을 오늘의집(Pretendard 기반) 스펙으로 재설정
    if (!s.migrations.fontTokensOhouseV1) {
      s.fontTokens = DEFAULT_FONT_TOKENS();
      s.migrations.fontTokensOhouseV1 = true;
    }
    // 1회성 마이그레이션 — 메인 1번 섹션을 오늘의집 레이아웃 v1 시안으로 자동 교체
    // (이전 HTML은 이력에 자동 보관 — "이력" 버튼에서 언제든 복원 가능)
    if (!s.migrations.mainBannerOhouseV1) {
      const mainPage = s.pages.find(p => p.id === 'main');
      if (mainPage && Array.isArray(mainPage.sections) && mainPage.sections.length > 0) {
        const sec = mainPage.sections[0];
        const now = new Date().toISOString();
        const key = mainPage.id + ':' + sec.id;
        s.history[key] = s.history[key] || [];
        s.history[key].unshift({
          name: sec.name,
          html: sec.html,
          note: sec.note || '',
          reason: '오늘의집 레이아웃 v1 시안 자동 적용 (이전 버전 자동 보관 — 이력에서 복원 가능)',
          kind: 'auto-migration',
          savedAt: now,
        });
        sec.html = OHOUSE_V1_SECTION_HTML;
        sec.note = '오늘의집 레이아웃 차용 v1 — 헤더·탭·2분할 히어로·카테고리 아이콘 10개 (모바일 반응형)';
        sec.status = 'wip';
        sec.statusAt = now;
        sec.confirmed = false;
        sec.confirmedAt = null;
      }
      s.migrations.mainBannerOhouseV1 = true;
    }
    // 1회성 마이그레이션 v2 — 메인 1번 섹션 폰트 정밀화 (Pretendard + 오늘의집 굵기·크기, POUR 오렌지 유지)
    if (!s.migrations.mainBannerOhouseV2) {
      const mainPage = s.pages.find(p => p.id === 'main');
      if (mainPage && Array.isArray(mainPage.sections) && mainPage.sections.length > 0) {
        const sec = mainPage.sections[0];
        const now = new Date().toISOString();
        const key = mainPage.id + ':' + sec.id;
        s.history[key] = s.history[key] || [];
        s.history[key].unshift({
          name: sec.name,
          html: sec.html,
          note: sec.note || '',
          reason: '오늘의집 레이아웃 v2 — 폰트 정밀화 (Pretendard 패밀리·굵기·크기 적용, POUR 오렌지 컬러 유지)',
          kind: 'auto-migration',
          savedAt: now,
        });
        sec.html = OHOUSE_V1_SECTION_HTML;
        sec.note = '오늘의집 레이아웃 v2 — Pretendard + 정밀 굵기·크기 (POUR 오렌지 컬러 유지, 모바일 반응형)';
        sec.statusAt = now;
      }
      s.migrations.mainBannerOhouseV2 = true;
    }
    // 1회성 마이그레이션 — 메인 2번 섹션을 오늘의집 "이런 사진 찾고 있나요?" 스타일로 자동 교체
    // (가로 스크롤 1:1 카드 + 필터 칩, 이전 HTML은 이력에 자동 보관)
    if (!s.migrations.mainSection2OhouseV1) {
      const mainPage = s.pages.find(p => p.id === 'main');
      if (mainPage && Array.isArray(mainPage.sections) && mainPage.sections.length > 1) {
        const sec = mainPage.sections[1];
        const now = new Date().toISOString();
        const key = mainPage.id + ':' + sec.id;
        s.history[key] = s.history[key] || [];
        s.history[key].unshift({
          name: sec.name,
          html: sec.html,
          note: sec.note || '',
          reason: '오늘의집 가로스크롤 카드 시안 자동 적용 (필터 칩 + 1:1 정사각 썸네일, 이전 버전 자동 보관)',
          kind: 'auto-migration',
          savedAt: now,
        });
        sec.html = OHOUSE_SECTION2_HTML;
        sec.note = '오늘의집 "이런 사진 찾고 있나요?" 스타일 — 메인 제목 + 필터 칩(방수/코팅/보수…) + 1:1 정사각 가로스크롤 카드 (모바일 반응형)';
        sec.status = 'wip';
        sec.statusAt = now;
        sec.confirmed = false;
        sec.confirmedAt = null;
      }
      s.migrations.mainSection2OhouseV1 = true;
    }
    // 1회성 마이그레이션 v2 — 메인 2번 섹션에 목재·돌/시멘트 그룹 추가 (3개 그룹 구조)
    if (!s.migrations.mainSection2OhouseV2) {
      const mainPage = s.pages.find(p => p.id === 'main');
      if (mainPage && Array.isArray(mainPage.sections) && mainPage.sections.length > 1) {
        const sec = mainPage.sections[1];
        const now = new Date().toISOString();
        const key = mainPage.id + ':' + sec.id;
        s.history[key] = s.history[key] || [];
        s.history[key].unshift({
          name: sec.name,
          html: sec.html,
          note: sec.note || '',
          reason: '목재·돌/시멘트 그룹 추가 (3그룹 구조 + 그룹별 독립 필터·스크롤, 이전 버전 자동 보관)',
          kind: 'auto-migration',
          savedAt: now,
        });
        sec.html = OHOUSE_SECTION2_HTML;
        sec.note = '오늘의집 스타일 — 철재·목재·돌/시멘트 3그룹 (각 그룹 독립 필터칩 + 1:1 정사각 가로스크롤)';
        sec.statusAt = now;
      }
      s.migrations.mainSection2OhouseV2 = true;
    }
    // 1회성 마이그레이션 — POUR닥터 전용 페이지 추가 + 메인 3번 섹션에 퀵배너 적용
    if (!s.migrations.pourDoctorV1) {
      const now = new Date().toISOString();
      // 1) POUR닥터 페이지가 없으면 추가
      if (!s.pages.find(p => p.id === 'pour-doctor')) {
        s.pages.push({
          id: 'pour-doctor',
          name: 'POUR닥터 (전용 페이지)',
          file: 'pour-doctor.html',
          parentId: null,
          type: 'page',
          sections: [
            mkSec('히어로 — 당신만의 건물 닥터', POUR_DR_HERO_HTML, '다크 네이비 + 라이브 진단 보드 + 5개 신뢰 수치 (의료·전문 톤)', 'wip'),
            mkSec('3단계 시공 프로세스', POUR_DR_PROCESS_HTML, '진단→처방→시공 매칭(선택) + 일반 쇼핑몰 비교표', 'wip'),
            mkSec('전문가 팀 + 빅데이터', POUR_DR_TRUST_HTML, 'R&D 박사·시공팀·AI 데이터팀 3카드 + 8개 핵심 수치 패널', 'wip'),
            mkSec('무료 진단 폼', POUR_DR_FORM_HTML, '건물유형·증상칩·메모·사진·연락처 — 3분 처방서 발송 CTA', 'wip'),
          ],
          feedbacks: [],
        });
      }
      // 2) 메인 페이지 3번 섹션을 POUR닥터 퀵배너로 교체
      const mainPage = s.pages.find(p => p.id === 'main');
      if (mainPage && Array.isArray(mainPage.sections) && mainPage.sections.length > 2) {
        const sec = mainPage.sections[2];
        const key = mainPage.id + ':' + sec.id;
        s.history[key] = s.history[key] || [];
        s.history[key].unshift({
          name: sec.name,
          html: sec.html,
          note: sec.note || '',
          reason: 'POUR닥터 진입 퀵배너 자동 적용 (이전 버전 자동 보관 — 이력에서 복원 가능)',
          kind: 'auto-migration',
          savedAt: now,
        });
        sec.name = 'POUR닥터 퀵배너 (전용 페이지 진입)';
        sec.html = POUR_DR_QUICK_BANNER_HTML;
        sec.note = 'POUR닥터 진입 퀵배너 — 다크 네이비 + 의료 메디컬 톤 + 4개 신뢰 수치, 클릭 시 pour-doctor.html로 이동';
        sec.status = 'wip';
        sec.statusAt = now;
        sec.confirmed = false;
        sec.confirmedAt = null;
      }
      s.migrations.pourDoctorV1 = true;
    }
    // 1회성 마이그레이션 — 워딩 일상어화 v1 (공법·기술 용어 → 초보자 친화 표현)
    // 적용 대상: 메인 1번(배너), 메인 2번(철재·돌시멘트 카드), 메인 3번(퀵배너 그대로),
    //          POUR닥터 히어로(라이브 보드), POUR닥터 처방 단계
    if (!s.migrations.plainWordingV1) {
      const now = new Date().toISOString();
      const overwrite = (page, idx, html, reason) => {
        if (!page || !Array.isArray(page.sections) || idx >= page.sections.length) return;
        const sec = page.sections[idx];
        const key = page.id + ':' + sec.id;
        s.history[key] = s.history[key] || [];
        s.history[key].unshift({
          name: sec.name, html: sec.html, note: sec.note || '',
          reason, kind: 'auto-migration', savedAt: now,
        });
        sec.html = html;
        sec.statusAt = now;
      };
      const mainPage = s.pages.find(p => p.id === 'main');
      const doctorPage = s.pages.find(p => p.id === 'pour-doctor');
      overwrite(mainPage, 0, OHOUSE_V1_SECTION_HTML, '메인 배너 — 사이드 상품명 일상어 변경 (POUR코트재 → 방수 자재)');
      overwrite(mainPage, 1, OHOUSE_SECTION2_HTML, '메인 2번 — 카드 제목·태그·라벨 일상어 변경 (공법명·기술 수치 → 효과 중심 카피)');
      overwrite(doctorPage, 0, POUR_DR_HERO_HTML, 'POUR닥터 히어로 — 라이브 보드 4건 공법명 제거');
      overwrite(doctorPage, 1, POUR_DR_PROCESS_HTML, 'POUR닥터 처방 단계 — "POUR 공법" → "맞춤 시공 방법" 변경');
      s.migrations.plainWordingV1 = true;
    }
    // 1회성 마이그레이션 v2 — POUR닥터 "관리(4단계)" 제거 → 3단계(진단·처방·시공 매칭)로 축소
    // 케어/체크업/관리 워딩 정리 + 시공 단계는 "선택"으로 명시 (셀프시공/매칭)
    if (!s.migrations.plainWordingV2) {
      const now2 = new Date().toISOString();
      const overwrite2 = (page, idx, html, name, note, reason) => {
        if (!page || !Array.isArray(page.sections) || idx >= page.sections.length) return;
        const sec = page.sections[idx];
        const key = page.id + ':' + sec.id;
        s.history[key] = s.history[key] || [];
        s.history[key].unshift({
          name: sec.name, html: sec.html, note: sec.note || '',
          reason, kind: 'auto-migration', savedAt: now2,
        });
        sec.html = html;
        if (name) sec.name = name;
        if (note) sec.note = note;
        sec.statusAt = now2;
      };
      const mainPage2 = s.pages.find(p => p.id === 'main');
      const doctorPage2 = s.pages.find(p => p.id === 'pour-doctor');
      overwrite2(mainPage2, 2, POUR_DR_QUICK_BANNER_HTML, null, null, 'POUR닥터 퀵배너 — "24시간 케어 중·케어 단지" → "지금도 진단 중·진단한 단지"로 워딩 정리');
      overwrite2(doctorPage2, 0, POUR_DR_HERO_HTML, null, '다크 네이비 + 라이브 진단 보드 + 5개 신뢰 수치 (의료·전문 톤, 관리/케어 워딩 제거)', 'POUR닥터 히어로 — "처방·시공·관리까지" → "처방서+시공 매칭까지", 케어 단지 → 진단한 단지');
      overwrite2(doctorPage2, 1, POUR_DR_PROCESS_HTML, '3단계 시공 프로세스', '진단→처방→시공 매칭(선택) + 일반 쇼핑몰 비교표', 'POUR닥터 프로세스 — 4단계(관리 포함)에서 3단계로 축소, 시공 단계를 셀프/매칭 선택으로 표기, 비교표 "시공 후 케어" 행 제거');
      s.migrations.plainWordingV2 = true;
    }
    // 1회성 마이그레이션 — POUR닥터 플로팅 FAB을 메인 페이지에 추가 (전체 시안 우하단 고정 버튼)
    if (!s.migrations.pourDoctorFabV1) {
      const mainPage3 = s.pages.find(p => p.id === 'main');
      if (mainPage3 && Array.isArray(mainPage3.sections)) {
        const already = mainPage3.sections.some(sec => (sec.html || '').indexOf('class="pdfab"') !== -1);
        if (!already) {
          mainPage3.sections.push(mkSec(
            'POUR닥터 플로팅 FAB (우하단 고정)',
            POUR_DR_FAB_HTML,
            '전체 시안 우하단에 항상 떠있는 진단 진입 버튼 — 펄스 링 + 라이브 도트 + 3초 후 툴팁 노출',
            'wip'
          ));
        }
      }
      s.migrations.pourDoctorFabV1 = true;
    }
    // 1회성 마이그레이션 — 메인 3번 퀵배너 카피 간소화 (어려움이 있다면 말씀해주세요 톤)
    if (!s.migrations.quickBannerCopyV1) {
      const mainPage4 = s.pages.find(p => p.id === 'main');
      if (mainPage4 && Array.isArray(mainPage4.sections)) {
        // class="pdq" 가 들어있는 섹션을 찾아 교체 (위치가 옮겨졌어도 안전하게)
        const idx = mainPage4.sections.findIndex(sec => (sec.html || '').indexOf('class="pdq"') !== -1);
        if (idx !== -1) {
          const sec = mainPage4.sections[idx];
          const now4 = new Date().toISOString();
          const key = mainPage4.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '퀵배너 카피 간소화 — 글자 줄이고 권유형 톤 ("어려움이 있다면, 편하게 말씀해 주세요")',
            kind: 'auto-migration', savedAt: now4,
          });
          sec.html = POUR_DR_QUICK_BANNER_HTML;
          sec.statusAt = now4;
        }
      }
      s.migrations.quickBannerCopyV1 = true;
    }
    // 1회성 마이그레이션 — 메인 1번 검색 영역에 POUR닥터 캐릭터 헬퍼 추가 (검색 포커스 시 펼침)
    if (!s.migrations.searchHelperV1) {
      const mainPage5 = s.pages.find(p => p.id === 'main');
      if (mainPage5 && Array.isArray(mainPage5.sections) && mainPage5.sections.length > 0) {
        const sec = mainPage5.sections[0];
        const now5 = new Date().toISOString();
        const key = mainPage5.id + ':' + sec.id;
        s.history[key] = s.history[key] || [];
        s.history[key].unshift({
          name: sec.name, html: sec.html, note: sec.note || '',
          reason: '검색바에 POUR닥터 캐릭터 헬퍼 추가 (포커스 시 캐릭터+말풍선+증상 추천 칩 펼침)',
          kind: 'auto-migration', savedAt: now5,
        });
        sec.html = OHOUSE_V1_SECTION_HTML;
        sec.statusAt = now5;
      }
      s.migrations.searchHelperV1 = true;
    }
    // 1회성 마이그레이션 — POUR닥터 캐릭터 실제 이미지 반영 + 섹션 3 재디자인
    if (!s.migrations.characterImageV1) {
      const mainPage6 = s.pages.find(p => p.id === 'main');
      if (mainPage6 && Array.isArray(mainPage6.sections)) {
        const now6 = new Date().toISOString();
        const overwrite6 = (idx, html, reason) => {
          if (idx < 0 || idx >= mainPage6.sections.length) return;
          const sec = mainPage6.sections[idx];
          const key = mainPage6.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason, kind: 'auto-migration', savedAt: now6,
          });
          sec.html = html;
          sec.statusAt = now6;
        };
        // 메인 1번 — 검색 헬퍼 SVG → 실제 캐릭터 이미지
        overwrite6(0, OHOUSE_V1_SECTION_HTML, '검색 헬퍼 캐릭터 — SVG 플레이스홀더 → 실제 3D 캐릭터 이미지로 교체');
        // 메인 3번 — 퀵배너 캐릭터 중심 재디자인
        const pdqIdx = mainPage6.sections.findIndex(sec => (sec.html || '').indexOf('class="pdq"') !== -1);
        if (pdqIdx !== -1) {
          overwrite6(pdqIdx, POUR_DR_QUICK_BANNER_HTML, '퀵배너 재디자인 — 캐릭터 전면 배치, 도트 패턴 배경, 말풍선, FREE 배지, 큰 CTA로 시선 집중');
        }
      }
      s.migrations.characterImageV1 = true;
    }
    // 1회성 마이그레이션 — 숏츠·서비스 섹션을 모바일에서 가로 슬라이드(숏츠는 자동)로 변경
    if (!s.migrations.mobileSliderV1) {
      const mainPage7 = s.pages.find(p => p.id === 'main');
      if (mainPage7 && Array.isArray(mainPage7.sections)) {
        const now7 = new Date().toISOString();
        const swap = (matchClass, html, reason) => {
          const idx = mainPage7.sections.findIndex(sec => (sec.html || '').indexOf(matchClass) !== -1);
          if (idx === -1) return;
          const sec = mainPage7.sections[idx];
          const key = mainPage7.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason, kind: 'auto-migration', savedAt: now7,
          });
          sec.html = html;
          sec.statusAt = now7;
        };
        swap('class="psy3"', SEED_YOUTUBE_HTML, '숏츠 섹션 — 모바일에서 가로 스크롤 + 4초 간격 천천히 자동 슬라이드 (터치/호버 시 일시정지, 화면 밖에서는 정지)');
        swap('class="psv2"', SEED_SERVICE_HTML, '서비스 안내 섹션 — 모바일에서 세로 적층 → 가로 스크롤 카드 (82% 너비, 다음 카드 살짝 보임)');
      }
      s.migrations.mobileSliderV1 = true;
    }
    // 1회성 마이그레이션 v2 — 서비스 섹션 탭+디테일 UI로 변경, 숏폼 자동재생→슬라이드 동기화
    if (!s.migrations.mobileSliderV2) {
      const mainPage8 = s.pages.find(p => p.id === 'main');
      if (mainPage8 && Array.isArray(mainPage8.sections)) {
        const now8 = new Date().toISOString();
        const swap8 = (matchClass, html, reason) => {
          const idx = mainPage8.sections.findIndex(sec => (sec.html || '').indexOf(matchClass) !== -1);
          if (idx === -1) return;
          const sec = mainPage8.sections[idx];
          const key = mainPage8.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason, kind: 'auto-migration', savedAt: now8,
          });
          sec.html = html;
          sec.statusAt = now8;
        };
        swap8('class="psv2"', SEED_SERVICE_HTML, '서비스 안내 — 가로 슬라이드 카드 → 탭+디테일 UI (공급 제휴 안에 대리점·인플루언서·유튜버·블로거 하위 채널 칩 포함)');
        swap8('class="psy3"', SEED_YOUTUBE_HTML, '숏폼 — 시간 기반 슬라이드 → 카드별 5초 자동재생(흰 프로그레스 바·오렌지 외곽선·빨간 플레이 강조) 후 다음 카드로 자동 슬라이드');
      }
      s.migrations.mobileSliderV2 = true;
    }
    // 1회성 마이그레이션 v3 — 섹션 3 라이트 톤 재디자인 + 서비스 아코디언으로 변경
    if (!s.migrations.uiRefreshV3) {
      const mainPage9 = s.pages.find(p => p.id === 'main');
      if (mainPage9 && Array.isArray(mainPage9.sections)) {
        const now9 = new Date().toISOString();
        const swap9 = (matchClass, html, reason) => {
          const idx = mainPage9.sections.findIndex(sec => (sec.html || '').indexOf(matchClass) !== -1);
          if (idx === -1) return;
          const sec = mainPage9.sections[idx];
          const key = mainPage9.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason, kind: 'auto-migration', savedAt: now9,
          });
          sec.html = html;
          sec.statusAt = now9;
        };
        swap9('class="pdq"', POUR_DR_QUICK_BANNER_HTML, 'POUR닥터 퀵배너 — 다크 네이비 → 크림+오렌지 라이트 톤 (브랜드 따뜻함 강조, 캐릭터 가독성 ↑)');
        swap9('class="psv2"', SEED_SERVICE_HTML, '서비스 안내 — 탭+디테일 → 아코디언 (탭하면 같은 자리에서 아래로 펼침, 한 번에 하나만 열림, 첫 항목 기본 펼침)');
      }
      s.migrations.uiRefreshV3 = true;
    }
    // 1회성 마이그레이션 — 서비스 안내 "인플루언서·유튜버" → "콘텐츠 크리에이터" 워딩 변경
    if (!s.migrations.creatorWordingV1) {
      const mainPageA = s.pages.find(p => p.id === 'main');
      if (mainPageA && Array.isArray(mainPageA.sections)) {
        const idx = mainPageA.sections.findIndex(sec => (sec.html || '').indexOf('class="psv2"') !== -1);
        if (idx !== -1) {
          const sec = mainPageA.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageA.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '서비스 안내 — "인플루언서·유튜버" → "콘텐츠 크리에이터"로 워딩 변경 (유튜브·인스타·틱톡·블로그 모두 포함하는 더 전문적인 표현)',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_SERVICE_HTML;
          sec.statusAt = now;
        }
      }
      s.migrations.creatorWordingV1 = true;
    }
    // 1회성 마이그레이션 — "공급 제휴" 카테고리 제거하고 "대리점"으로 복원 (크리에이터·블로거 카테고리 표면 노출 제거)
    if (!s.migrations.dealerBackV1) {
      const mainPageB = s.pages.find(p => p.id === 'main');
      if (mainPageB && Array.isArray(mainPageB.sections)) {
        const idx = mainPageB.sections.findIndex(sec => (sec.html || '').indexOf('class="psv2"') !== -1);
        if (idx !== -1) {
          const sec = mainPageB.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageB.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '서비스 안내 — "공급 제휴(크리에이터·블로거 포함)" 카테고리 제거하고 "대리점" 단일 채널로 복원 (R&D·특허 기반 기업 브랜드 톤 유지, 인플루언서 마케팅 인상 차단)',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_SERVICE_HTML;
          sec.statusAt = now;
        }
      }
      s.migrations.dealerBackV1 = true;
    }
    // 1회성 마이그레이션 — 매거진 모바일 가로 스크롤 + 섹션 3 말풍선 디자인
    if (!s.migrations.speechBubbleV1) {
      const mainPageC = s.pages.find(p => p.id === 'main');
      if (mainPageC && Array.isArray(mainPageC.sections)) {
        const now = new Date().toISOString();
        const swap = (matchClass, html, reason) => {
          const idx = mainPageC.sections.findIndex(sec => (sec.html || '').indexOf(matchClass) !== -1);
          if (idx === -1) return;
          const sec = mainPageC.sections[idx];
          const key = mainPageC.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason, kind: 'auto-migration', savedAt: now,
          });
          sec.html = html;
          sec.statusAt = now;
        };
        swap('class="psg3"', SEED_POSTING_HTML, '매거진 — 모바일 가로 스크롤 적용 (Feature 카드 풀폭 + 비특집 3개는 76% 너비 가로 스크롤·peek)');
        swap('class="pdq"', POUR_DR_QUICK_BANNER_HTML, 'POUR닥터 — 핵심 카피를 큰 말풍선으로 강조 (캐릭터 쪽 꼬리 + 따옴표 데코 + 살짝 흔들리는 sway 애니메이션, 강조 단어에 노란 형광펜)');
      }
      s.migrations.speechBubbleV1 = true;
    }
    // 1회성 마이그레이션 — POUR주치의 → POUR닥터 명칭 통일 (HTML·섹션 이름·페이지 이름 모두 갱신)
    if (!s.migrations.pourDoctorRenameV1) {
      const now = new Date().toISOString();
      // 1) POUR닥터 페이지 자체의 이름 변경
      const doctorPage = s.pages.find(p => p.id === 'pour-doctor');
      if (doctorPage) {
        if (doctorPage.name && doctorPage.name.indexOf('주치의') !== -1) {
          doctorPage.name = doctorPage.name.replace(/주치의/g, '닥터');
        }
        // 페이지 내 섹션들도 갱신 (히어로·프로세스·트러스트·폼)
        if (Array.isArray(doctorPage.sections)) {
          const htmlMap = [POUR_DR_HERO_HTML, POUR_DR_PROCESS_HTML, POUR_DR_TRUST_HTML, POUR_DR_FORM_HTML];
          doctorPage.sections.forEach((sec, i) => {
            if (sec.name && sec.name.indexOf('주치의') !== -1) {
              sec.name = sec.name.replace(/주치의/g, '닥터');
            }
            if (i < htmlMap.length && htmlMap[i]) {
              const key = doctorPage.id + ':' + sec.id;
              s.history[key] = s.history[key] || [];
              s.history[key].unshift({
                name: sec.name, html: sec.html, note: sec.note || '',
                reason: 'POUR주치의 → POUR닥터 명칭 통일 (HTML 내 모든 표기 일괄 변경)',
                kind: 'auto-migration', savedAt: now,
              });
              sec.html = htmlMap[i];
              sec.statusAt = now;
            }
          });
        }
      }
      // 2) 메인 페이지 — 퀵배너·검색 헬퍼·FAB 모두 갱신
      const mainPageR = s.pages.find(p => p.id === 'main');
      if (mainPageR && Array.isArray(mainPageR.sections)) {
        const swap = (matchClass, html, reason) => {
          const idx = mainPageR.sections.findIndex(sec => (sec.html || '').indexOf(matchClass) !== -1);
          if (idx === -1) return;
          const sec = mainPageR.sections[idx];
          if (sec.name && sec.name.indexOf('주치의') !== -1) sec.name = sec.name.replace(/주치의/g, '닥터');
          const key = mainPageR.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason, kind: 'auto-migration', savedAt: now,
          });
          sec.html = html;
          sec.statusAt = now;
        };
        swap('class="psm1"', OHOUSE_V1_SECTION_HTML, '메인 1번 검색 헬퍼 — POUR주치의 → POUR닥터 표기 통일 (alt·코멘트 포함)');
        swap('class="pdq"', POUR_DR_QUICK_BANNER_HTML, '메인 3번 퀵배너 — POUR주치의 → POUR닥터 표기 통일');
        swap('class="pdfab"', POUR_DR_FAB_HTML, '플로팅 FAB — POUR주치의 → POUR닥터 표기 통일 (aria-label·메시지 포함)');
      }
      s.migrations.pourDoctorRenameV1 = true;
    }
    // 1회성 마이그레이션 — 플로팅 FAB 아이콘을 청진기 SVG → 캐릭터 얼굴 이미지로 교체
    if (!s.migrations.fabFaceV1) {
      const mainPageF = s.pages.find(p => p.id === 'main');
      if (mainPageF && Array.isArray(mainPageF.sections)) {
        const idx = mainPageF.sections.findIndex(sec => (sec.html || '').indexOf('class="pdfab"') !== -1);
        if (idx !== -1) {
          const sec = mainPageF.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageF.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '플로팅 FAB — 청진기 SVG 아이콘 → POUR닥터 캐릭터 얼굴 이미지 (object-position center 22%로 얼굴 영역 크롭)',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = POUR_DR_FAB_HTML;
          sec.statusAt = now;
        }
      }
      s.migrations.fabFaceV1 = true;
    }
    // 1회성 마이그레이션 — 매거진 2번째 행 자동 슬라이드 (숏폼 동일 패턴, 6초 간격)
    if (!s.migrations.magazineAutoSlideV1) {
      const mainPageM = s.pages.find(p => p.id === 'main');
      if (mainPageM && Array.isArray(mainPageM.sections)) {
        const idx = mainPageM.sections.findIndex(sec => (sec.html || '').indexOf('class="psg3"') !== -1);
        if (idx !== -1) {
          const sec = mainPageM.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageM.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '매거진 2번째 행 — 모바일 가로 스크롤에 자동 슬라이드 추가 (6초 간격, 오렌지 프로그레스 바 + 활성 카드 외곽선, 화면 안에서만 동작·탭/터치/호버 시 일시정지)',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_POSTING_HTML;
          sec.statusAt = now;
        }
      }
      s.migrations.magazineAutoSlideV1 = true;
    }
    // 1회성 마이그레이션 — 실적관(iframe) → 브랜드 일관 디자인으로 교체
    if (!s.migrations.statsRedesignV1) {
      const mainPageS = s.pages.find(p => p.id === 'main');
      if (mainPageS && Array.isArray(mainPageS.sections)) {
        // iframe 임베드인 기존 실적관 또는 새 디자인이 이미 있는 경우 모두 매칭
        const idx = mainPageS.sections.findIndex(sec => {
          const h = sec.html || '';
          return (h.indexOf('pour-store-cafe24.html') !== -1) || (h.indexOf('class="pst1"') !== -1);
        });
        if (idx !== -1) {
          const sec = mainPageS.sections[idx];
          // 이미 새 디자인이면 스킵 (중복 적용 방지)
          if ((sec.html || '').indexOf('class="pst1"') === -1) {
            const now = new Date().toISOString();
            const key = mainPageS.id + ':' + sec.id;
            s.history[key] = s.history[key] || [];
            s.history[key].unshift({
              name: sec.name, html: sec.html, note: sec.note || '',
              reason: '실적관 — iframe 임베드(pour-store-cafe24.html) → 브랜드 일관 디자인 (6개 신뢰 수치 카드 + 시공 갤러리 6장 가로 스크롤 + 협력사·인증 알약 배지, 라이트 톤·Pretendard·POUR 컬러)',
              kind: 'auto-migration', savedAt: now,
            });
            sec.html = SEED_STATS_HTML;
            sec.note = '신뢰의 숫자 6개 카드(그라데이션 텍스트) + 시공 갤러리 6장(가로 스크롤) + 협력사·인증 알약 배지 (라이트 톤·Pretendard)';
            sec.statusAt = now;
          }
        }
      }
      s.migrations.statsRedesignV1 = true;
    }
    // 1회성 마이그레이션 v2 — 실적관 갤러리 제거 + 숫자 카운팅 + 로고 마키 슬라이드
    if (!s.migrations.statsRedesignV2) {
      const mainPageS2 = s.pages.find(p => p.id === 'main');
      if (mainPageS2 && Array.isArray(mainPageS2.sections)) {
        const idx = mainPageS2.sections.findIndex(sec => (sec.html || '').indexOf('class="pst1"') !== -1);
        if (idx !== -1) {
          const sec = mainPageS2.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageS2.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '실적관 — 시공 갤러리 제거, 숫자 6개에 카운팅 애니메이션 추가, 협력사 알약 → 로고 무한 마키 슬라이드(호버 시 정지·접근성 reduce-motion 대응)',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_STATS_HTML;
          sec.note = '신뢰의 숫자 6개 카드 (IntersectionObserver 카운팅) + 협력사·인증 8개 로고 무한 마키 슬라이드 — 라이트 톤·Pretendard';
          sec.statusAt = now;
        }
      }
      s.migrations.statsRedesignV2 = true;
    }
    // 1회성 마이그레이션 v3 — 로고 마키 슬라이드 → 정적 flex-wrap 그리드(자동 줄바꿈)로 복귀
    if (!s.migrations.statsRedesignV3) {
      const mainPageS3 = s.pages.find(p => p.id === 'main');
      if (mainPageS3 && Array.isArray(mainPageS3.sections)) {
        const idx = mainPageS3.sections.findIndex(sec => (sec.html || '').indexOf('class="pst1"') !== -1);
        if (idx !== -1) {
          const sec = mainPageS3.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageS3.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '실적관 로고 — 무한 마키 슬라이드 → 정적 flex-wrap 알약 그리드 (자동 줄바꿈, 가운데 정렬). 카운팅 애니메이션은 유지.',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_STATS_HTML;
          sec.note = '신뢰의 숫자 6개 카드 (IntersectionObserver 카운팅) + 협력사·인증 8개 로고 자동 줄바꿈 그리드 — 라이트 톤·Pretendard';
          sec.statusAt = now;
        }
      }
      s.migrations.statsRedesignV3 = true;
    }
    // 1회성 마이그레이션 v4 — 시공 현장 갤러리 슬라이드 추가 + 협력사 로고 4행 마키 (cafe24 원본 48개 시공사 반영)
    if (!s.migrations.statsRedesignV4) {
      const mainPageS4 = s.pages.find(p => p.id === 'main');
      if (mainPageS4 && Array.isArray(mainPageS4.sections)) {
        const idx = mainPageS4.sections.findIndex(sec => (sec.html || '').indexOf('class="pst1"') !== -1);
        if (idx !== -1) {
          const sec = mainPageS4.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageS4.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '실적관 — 다크 네이비 시공 현장 갤러리(가로 슬라이드 6장) 상단 추가 + 협력사 로고를 4행 마키 슬라이드(좌·우 교차, 행별 다른 속도)로 교체. 로고는 cafe24 원본에서 추출한 48개 실제 시공사명 사용.',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_STATS_HTML;
          sec.note = '시공 현장 갤러리(다크 네이비, 가로 슬라이드 6장) + 숫자 6개 카드 (IntersectionObserver 카운팅) + 협력사 48개 로고 4행 마키 슬라이드(좌·우 교차) — 라이트 톤·Pretendard';
          sec.statusAt = now;
        }
      }
      s.migrations.statsRedesignV4 = true;
    }
    // 1회성 마이그레이션 v5 — Firebase Storage 이미지 동적 로드 복원 (시공 현장 사진 + 협력사 로고)
    if (!s.migrations.statsRedesignV5) {
      const mainPageS5 = s.pages.find(p => p.id === 'main');
      if (mainPageS5 && Array.isArray(mainPageS5.sections)) {
        const idx = mainPageS5.sections.findIndex(sec => (sec.html || '').indexOf('class="pst1"') !== -1);
        if (idx !== -1) {
          const sec = mainPageS5.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageS5.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '실적관 — Firebase Storage 이미지 동적 로드 복원. 시공 현장 6장은 "POUR스토어_리뉴얼/자사몰/아파트, 공장, 병원~ ,, 여러협력사사용중" 폴더, 협력사 로고는 "협력사 로고들" 폴더 listAll. 로드 실패 시 SVG/텍스트 fallback 유지.',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_STATS_HTML;
          sec.statusAt = now;
        }
      }
      s.migrations.statsRedesignV5 = true;
    }
    // 1회성 마이그레이션 v6 — 전 영역 다크 네이비 통일 + 시공 현장 자동 마키(텍스트 라벨 제거, 12장으로 확대)
    if (!s.migrations.statsRedesignV6) {
      const mainPageS6 = s.pages.find(p => p.id === 'main');
      if (mainPageS6 && Array.isArray(mainPageS6.sections)) {
        const idx = mainPageS6.sections.findIndex(sec => (sec.html || '').indexOf('class="pst1"') !== -1);
        if (idx !== -1) {
          const sec = mainPageS6.sections[idx];
          const now = new Date().toISOString();
          const key = mainPageS6.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '실적관 — 원본 cafe24처럼 전 영역 다크 네이비 배경으로 통일하고 POUR 오렌지로 액센트만 적용. 시공 현장은 마키 자동 슬라이드(60초)·12장으로 확대·하단 텍스트 라벨(지역명) 제거. 숫자 카드는 반투명 흰 카드(rgba)로 다크 위에 자연스럽게 배치. 로고 4행 마키는 흰 카드(다크 위 대비)로 유지.',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_STATS_HTML;
          sec.note = '전 영역 다크 네이비 + POUR 오렌지 액센트로 통일. 시공 현장 12장 마키 자동 슬라이드(텍스트 라벨 X) + 숫자 6개 카드(카운팅) + 협력사 48개 로고 4행 마키 슬라이드.';
          sec.statusAt = now;
        }
      }
      s.migrations.statsRedesignV6 = true;
    }
    // 1회성 마이그레이션 v7 — 실적관 원본(iframe + cafe24) 복원, 톤만 POUR 브랜드와 통일
    if (!s.migrations.statsRevertV7) {
      const mainPageS7 = s.pages.find(p => p.id === 'main');
      if (mainPageS7 && Array.isArray(mainPageS7.sections)) {
        // class="pst1" 또는 기존 iframe을 가진 섹션을 찾아 SEED_STATS_HTML(iframe)로 통일
        const idx = mainPageS7.sections.findIndex(sec => {
          const h = sec.html || '';
          return (h.indexOf('class="pst1"') !== -1) || (h.indexOf('pour-store-cafe24.html') !== -1);
        });
        if (idx !== -1) {
          const sec = mainPageS7.sections[idx];
          // 이미 새 iframe-only 버전이면 스킵
          if (!(sec.html || '').match(/^\s*<section[^>]*background:linear-gradient[^>]*>\s*<iframe src="\.\/pour-store-cafe24/m)) {
            const now = new Date().toISOString();
            const key = mainPageS7.id + ':' + sec.id;
            s.history[key] = s.history[key] || [];
            s.history[key].unshift({
              name: sec.name, html: sec.html, note: sec.note || '',
              reason: '실적관 — 원본 iframe(cafe24) 복원. 톤만 POUR 브랜드(Pretendard + 오렌지 #E8780F + 네이비 #0F1F5C)로 통일하기 위해 pour-store-cafe24.html에 폰트·컬러·자간 오버라이드 CSS 주입. 기능·텍스트 내용은 그대로 유지.',
              kind: 'auto-migration', savedAt: now,
            });
            sec.html = SEED_STATS_HTML;
            sec.note = '원본 cafe24 페이지를 iframe으로 임베드. pour-store-cafe24.html에 Pretendard 폰트 + POUR 오렌지/네이비 컬러 오버라이드 CSS 적용해 형제 섹션과 톤 통일.';
            sec.statusAt = now;
          }
        }
      }
      s.migrations.statsRevertV7 = true;
    }
    // 1회성 마이그레이션 — 대리점주 대시보드 디자인 섹션 추가
    if (!s.migrations.dealerDashboardV1) {
      // 페이지 이름에 "대시보드"와 "대리점" 포함된 페이지 찾기
      const dashPage = s.pages.find(p => p.name && p.name.indexOf('대시보드') !== -1 && p.name.indexOf('대리점') !== -1);
      if (dashPage && Array.isArray(dashPage.sections)) {
        // class="pdb-dealer"가 이미 있으면 중복 추가 안 함
        const exists = dashPage.sections.some(sec => (sec.html || '').indexOf('class="pdb pdb-dealer"') !== -1);
        if (!exists) {
          dashPage.sections.push(mkSec(
            '대리점주 대시보드 (디자인 시안)',
            SEED_DASH_DEALER_HTML,
            'GOLD 등급 + 회원정보 헤더 · KPI 4종(매출/발주/정산예정/대기) · 정산 상세 + 최근 발주 5건 · 빠른 액션 4종 · 본사 공지 — Pretendard·POUR 브랜드 톤, 모바일 반응형',
            'wip'
          ));
        }
      }
      s.migrations.dealerDashboardV1 = true;
    }
    // 1회성 마이그레이션 v2 — 대리점주 대시보드를 토스 스타일로 재디자인
    if (!s.migrations.dealerDashboardV2) {
      const dashPage2 = s.pages.find(p => p.name && p.name.indexOf('대시보드') !== -1 && p.name.indexOf('대리점') !== -1);
      if (dashPage2 && Array.isArray(dashPage2.sections)) {
        const idx = dashPage2.sections.findIndex(sec => (sec.html || '').indexOf('class="pdb pdb-dealer"') !== -1);
        if (idx !== -1) {
          const sec = dashPage2.sections[idx];
          const now = new Date().toISOString();
          const key = dashPage2.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '대리점주 대시보드 — 토스 스타일로 재디자인 (흰 배경 720px 좁은 폭, 큰 hero 매출 카드 크림+오렌지, 미니 KPI 3개, 큰 오렌지 CTA, 빠른 액션 4종, 정산 4행 카드, 최근 발주·공지 리스트). 컬러는 POUR 오렌지·네이비 그대로 유지.',
            kind: 'auto-migration', savedAt: now,
          });
          sec.html = SEED_DASH_DEALER_HTML;
          sec.note = '토스 스타일 — 흰 배경 + POUR 오렌지/네이비 강조. 인사 + 큰 매출 hero + 미니 KPI 3개 + 오렌지 CTA + 빠른 액션 4 + 정산 카드 + 발주 리스트 + 공지 리스트. 모바일 반응형.';
          sec.statusAt = now;
        }
      }
      s.migrations.dealerDashboardV2 = true;
    }
    // 1회성 마이그레이션 — 대리점 모집 소개 페이지 (Hero · 혜택 · 등급제 · 절차 · FAQ · CTA)
    if (!s.migrations.dealerIntroV1) {
      // "대시보드" 단어가 없고 "대리점" + "소개"가 있는 페이지 찾기
      const introPage = s.pages.find(p => p.name && p.name.indexOf('대시보드') === -1 && p.name.indexOf('대리점') !== -1 && p.name.indexOf('소개') !== -1);
      if (introPage && Array.isArray(introPage.sections)) {
        const exists = introPage.sections.some(sec => (sec.html || '').indexOf('class="pin pin-dealer"') !== -1);
        if (!exists) {
          introPage.sections.push(mkSec(
            '대리점 모집 소개 (디자인 시안)',
            SEED_INTRO_DEALER_HTML,
            'Hero(혜택 3종 수치) + 6개 혜택 카드 + 3단계 등급제(Silver/Gold/Platinum 마진 22~35%) + 5단계 신청 절차 + FAQ 5건 + 다크 네이비 Bottom CTA. 토스 스타일·POUR 오렌지/네이비, 모바일 반응형.',
            'wip'
          ));
        }
      }
      s.migrations.dealerIntroV1 = true;
    }
    // 1회성 마이그레이션 — POUR닥터 퀵배너 캐릭터 실제 이미지 반영 + 여백 정리
    if (!s.migrations.quickBannerImageV2) {
      const qbPage = s.pages.find(p => p.id === 'main');
      if (qbPage && Array.isArray(qbPage.sections)) {
        const idx = qbPage.sections.findIndex(sec => (sec.html || '').indexOf('class="pdq"') !== -1);
        if (idx !== -1) {
          const sec = qbPage.sections[idx];
          const nowQb = new Date().toISOString();
          const key = qbPage.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: 'POUR닥터 퀵배너 — 깨진 캐릭터 이미지를 실제 비버 닥터 이미지(Firebase)로 교체 + 말풍선 전체폭·캐릭터 열·패딩 정리로 빈 여백 제거',
            kind: 'auto-migration', savedAt: nowQb,
          });
          sec.html = POUR_DR_QUICK_BANNER_HTML;
          sec.statusAt = nowQb;
        }
      }
      s.migrations.quickBannerImageV2 = true;
    }
    // 1회성 마이그레이션 — POUR닥터 퀵배너/검색요정 (투명 배경 비버 + 모바일 세로 재설계)
    if (!s.migrations.quickBannerRedesignV11) {
      const mp = s.pages.find(p => p.id === 'main');
      if (mp && Array.isArray(mp.sections)) {
        const nowR = new Date().toISOString();
        const swapR = (matchClass, html, reason) => {
          const idx = mp.sections.findIndex(sec => (sec.html || '').indexOf(matchClass) !== -1);
          if (idx === -1) return;
          const sec = mp.sections[idx];
          const key = mp.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason, kind: 'auto-migration', savedAt: nowR,
          });
          sec.html = html;
          sec.statusAt = nowR;
        };
        swapR('class="pdq"', POUR_DR_QUICK_BANNER_HTML, 'POUR닥터 퀵배너 — 배경 누끼한 투명 비버 이미지 적용(흰 박스 제거) + 모바일 세로 재설계(마스코트 상단 중앙·전체폭 말풍선·풀폭 CTA)');
        swapR('class="psm1"', OHOUSE_V1_SECTION_HTML, '검색바 마스코트 요정 — 배경 누끼한 투명 비버 이미지로 교체(흰 박스 제거), 클릭 시 진단 헬퍼 펼침');
      }
      s.migrations.quickBannerRedesignV11 = true;
    }
    // 숏츠 섹션 — 모바일 2열 그리드 / PC 1줄(5열) 재구성
    if (!s.migrations.shortsGrid2colV1) {
      const mpS = s.pages.find(p => p.id === 'main');
      if (mpS && Array.isArray(mpS.sections)) {
        const nowS = new Date().toISOString();
        const idx = mpS.sections.findIndex(sec => (sec.html || '').indexOf('class="psy3"') !== -1);
        if (idx !== -1) {
          const sec = mpS.sections[idx];
          const key = mpS.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '숏츠 섹션 — 모바일 한 화면 2열 그리드 / PC 1줄(5열)로 재구성, 자동 가로스크롤 제거',
            kind: 'auto-migration', savedAt: nowS,
          });
          sec.html = SEED_YOUTUBE_HTML;
          sec.statusAt = nowS;
        }
      }
      s.migrations.shortsGrid2colV1 = true;
    }
    // 숏츠 섹션 — 모바일에서 정확히 2행(4장)만 노출하도록 5번째 카드 숨김
    if (!s.migrations.shortsGrid2rowV1) {
      const mpS2 = s.pages.find(p => p.id === 'main');
      if (mpS2 && Array.isArray(mpS2.sections)) {
        const nowS2 = new Date().toISOString();
        const idx = mpS2.sections.findIndex(sec => (sec.html || '').indexOf('class="psy3"') !== -1);
        if (idx !== -1) {
          const sec = mpS2.sections[idx];
          const key = mpS2.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '숏츠 섹션 — 모바일 2행(4장)으로 고정, 자동순환은 보이는 카드만',
            kind: 'auto-migration', savedAt: nowS2,
          });
          sec.html = SEED_YOUTUBE_HTML;
          sec.statusAt = nowS2;
        }
      }
      s.migrations.shortsGrid2rowV1 = true;
    }
    // 카테고리(퀵메뉴) — 모바일 3열×3행 균형 + 아이콘 확대
    if (!s.migrations.categoryGrid3colV1) {
      const mpC = s.pages.find(p => p.id === 'main');
      if (mpC && Array.isArray(mpC.sections)) {
        const nowC = new Date().toISOString();
        const idx = mpC.sections.findIndex(sec => (sec.html || '').indexOf('class="psc3"') !== -1);
        if (idx !== -1) {
          const sec = mpC.sections[idx];
          const key = mpC.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '카테고리 퀵메뉴 — 모바일 4열(외톨이 발생) → 3열×3행 균형, 아이콘·라벨 확대',
            kind: 'auto-migration', savedAt: nowC,
          });
          sec.html = SEED_CATEGORY_HTML;
          sec.statusAt = nowC;
        }
      }
      s.migrations.categoryGrid3colV1 = true;
    }
    // 동영상 가이드 — 모바일 추천 카드 플레이버튼/제목 겹침 해소
    if (!s.migrations.videoGuideMobileV1) {
      const mpV = s.pages.find(p => p.id === 'main');
      if (mpV && Array.isArray(mpV.sections)) {
        const nowV = new Date().toISOString();
        const idx = mpV.sections.findIndex(sec => (sec.html || '').indexOf('class="psg4"') !== -1);
        if (idx !== -1) {
          const sec = mpV.sections[idx];
          const key = mpV.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason: '동영상 가이드 — 모바일 추천 카드 4:3 비율·플레이버튼 상단 이동으로 제목 겹침 해소',
            kind: 'auto-migration', savedAt: nowV,
          });
          sec.html = SEED_VIDEO_GUIDE_HTML;
          sec.statusAt = nowV;
        }
      }
      s.migrations.videoGuideMobileV1 = true;
    }
    // 가로 스와이프 힌트 — 매거진·동영상 미니리스트에 "옆으로 밀어 더 보기" 칩 + 넛지
    if (!s.migrations.swipeHintsV1) {
      const mpH = s.pages.find(p => p.id === 'main');
      if (mpH && Array.isArray(mpH.sections)) {
        const nowH = new Date().toISOString();
        const swapH = (matchClass, html, reason) => {
          const i = mpH.sections.findIndex(sec => (sec.html || '').indexOf(matchClass) !== -1);
          if (i === -1) return;
          const sec = mpH.sections[i];
          const key = mpH.id + ':' + sec.id;
          s.history[key] = s.history[key] || [];
          s.history[key].unshift({
            name: sec.name, html: sec.html, note: sec.note || '',
            reason, kind: 'auto-migration', savedAt: nowH,
          });
          sec.html = html;
          sec.statusAt = nowH;
        };
        swapH('class="psg3"', SEED_POSTING_HTML, '매거진 — 모바일 가로 스와이프에 "옆으로 밀어 더 보기 →" 힌트 칩 추가');
        swapH('class="psg4"', SEED_VIDEO_GUIDE_HTML, '동영상 — 미니리스트 가로 스와이프에 넛지 모션 + "옆으로 밀어 더 보기 →" 힌트 칩 추가');
      }
      s.migrations.swipeHintsV1 = true;
    }
    // 실적 섹션 — cafe24 iframe(다크) → 네이티브 라이트 톤 재구축
    if (!s.migrations.statsNativeV1) {
      const mpStat = s.pages.find(p => p.id === 'store-showcase') || s.pages.find(p => p.id === 'main');
      // 모든 페이지에서 iframe 실적 섹션을 찾아 교체 (페이지 id 불확실 대비)
      const nowStat = new Date().toISOString();
      s.pages.forEach(pg => {
        if (!Array.isArray(pg.sections)) return;
        pg.sections.forEach(sec => {
          const h = sec.html || '';
          if (h.indexOf('pour-store-cafe24.html') !== -1 || h.indexOf('class="pst1"') !== -1) {
            const key = pg.id + ':' + sec.id;
            s.history[key] = s.history[key] || [];
            s.history[key].unshift({
              name: sec.name, html: sec.html, note: sec.note || '',
              reason: '실적 섹션 — cafe24 iframe(다크) → 네이티브 라이트 크림+오렌지 톤 재구축 (수치 4종 + 전국 시공 갤러리 19장)',
              kind: 'auto-migration', savedAt: nowStat,
            });
            sec.html = POUR_STATS_NATIVE_HTML;
            sec.statusAt = nowStat;
          }
        });
      });
      s.migrations.statsNativeV1 = true;
    }
    // 검색바 마스코트 — 모바일 헤더에도 POUR닥터 상시 노출
    if (!s.migrations.mobileDoctorV1) {
      const nowMD = new Date().toISOString();
      s.pages.forEach(pg => {
        if (!Array.isArray(pg.sections)) return;
        pg.sections.forEach(sec => {
          if ((sec.html || '').indexOf('class="psm1"') !== -1) {
            const key = pg.id + ':' + sec.id;
            s.history[key] = s.history[key] || [];
            s.history[key].unshift({
              name: sec.name, html: sec.html, note: sec.note || '',
              reason: '검색바 마스코트 — 모바일 헤더(≤700px)에서 검색바 숨김으로 안 보이던 POUR닥터를, 모바일 헤더 검색 아이콘 옆에 상시 노출(탭 시 진단 페이지 이동)',
              kind: 'auto-migration', savedAt: nowMD,
            });
            sec.html = OHOUSE_V1_SECTION_HTML;
            sec.statusAt = nowMD;
          }
        });
      });
      s.migrations.mobileDoctorV1 = true;
    }
    // 요정 캐릭터 이미지 교체(beaver_search_fairy_nukki) + 실적 협력사 로고 80개 추가
    if (!s.migrations.fairyLogosV1) {
      const nowFL = new Date().toISOString();
      const reswap = (matchClass, html, reason) => {
        s.pages.forEach(pg => {
          if (!Array.isArray(pg.sections)) return;
          pg.sections.forEach(sec => {
            if ((sec.html || '').indexOf(matchClass) !== -1) {
              const key = pg.id + ':' + sec.id;
              s.history[key] = s.history[key] || [];
              s.history[key].unshift({
                name: sec.name, html: sec.html, note: sec.note || '',
                reason, kind: 'auto-migration', savedAt: nowFL,
              });
              sec.html = html;
              sec.statusAt = nowFL;
            }
          });
        });
      };
      reswap('class="psm1"', OHOUSE_V1_SECTION_HTML, '검색 마스코트 — 요정 캐릭터 이미지(beaver_search_fairy_nukki)로 교체');
      reswap('class="pdq"', POUR_DR_QUICK_BANNER_HTML, 'POUR닥터 퀵배너 — 요정 캐릭터 이미지(beaver_search_fairy_nukki)로 교체');
      reswap('class="pst2"', POUR_STATS_NATIVE_HTML, '실적 섹션 — 함께한 시공 협력사 로고 80개 추가');
      s.migrations.fairyLogosV1 = true;
    }
    // 모바일 헤더 요정 마스코트 크게(44→62px) + 탭 위로 걸터앉는 히어로 느낌
    if (!s.migrations.bigDoctorV1) {
      const nowBD = new Date().toISOString();
      s.pages.forEach(pg => {
        if (!Array.isArray(pg.sections)) return;
        pg.sections.forEach(sec => {
          if ((sec.html || '').indexOf('class="psm1"') !== -1) {
            const key = pg.id + ':' + sec.id;
            s.history[key] = s.history[key] || [];
            s.history[key].unshift({
              name: sec.name, html: sec.html, note: sec.note || '',
              reason: '모바일 헤더 요정 마스코트 확대(44→62px) + 탭 바 위로 걸터앉는 히어로 느낌',
              kind: 'auto-migration', savedAt: nowBD,
            });
            sec.html = OHOUSE_V1_SECTION_HTML;
            sec.statusAt = nowBD;
          }
        });
      });
      s.migrations.bigDoctorV1 = true;
    }
    // 모바일 헤더에 실제 검색바 추가 + 요정이 검색바 위에 걸터앉는 레이아웃
    if (!s.migrations.mbSearchbarV1) {
      const nowMS = new Date().toISOString();
      s.pages.forEach(pg => {
        if (!Array.isArray(pg.sections)) return;
        pg.sections.forEach(sec => {
          if ((sec.html || '').indexOf('class="psm1"') !== -1) {
            const key = pg.id + ':' + sec.id;
            s.history[key] = s.history[key] || [];
            s.history[key].unshift({
              name: sec.name, html: sec.html, note: sec.note || '',
              reason: '모바일 헤더에 전체폭 검색바 추가 + 요정이 검색바 위에 걸터앉아 돋보기로 들여다보는 히어로 레이아웃(첨부 시안)',
              kind: 'auto-migration', savedAt: nowMS,
            });
            sec.html = OHOUSE_V1_SECTION_HTML;
            sec.statusAt = nowMS;
          }
        });
      });
      s.migrations.mbSearchbarV1 = true;
    }
    // 퀵배너 캐릭터 기존 비버로 복구 + 모바일 로고 떠 있는 'P' 마크 제거
    if (!s.migrations.bannerRevertLogoFixV1) {
      const nowBR = new Date().toISOString();
      const reswap2 = (matchClass, html, reason) => {
        s.pages.forEach(pg => {
          if (!Array.isArray(pg.sections)) return;
          pg.sections.forEach(sec => {
            if ((sec.html || '').indexOf(matchClass) !== -1) {
              const key = pg.id + ':' + sec.id;
              s.history[key] = s.history[key] || [];
              s.history[key].unshift({
                name: sec.name, html: sec.html, note: sec.note || '',
                reason, kind: 'auto-migration', savedAt: nowBR,
              });
              sec.html = html;
              sec.statusAt = nowBR;
            }
          });
        });
      };
      reswap2('class="pdq"', POUR_DR_QUICK_BANNER_HTML, '퀵배너 — 요정으로 잘못 바뀐 캐릭터를 기존 비버 닥터로 복구');
      reswap2('class="psm1"', OHOUSE_V1_SECTION_HTML, '모바일 로고 — 옆에 떠 있던 P 마크 제거');
      s.migrations.bannerRevertLogoFixV1 = true;
    }
    // 협력사 로고 — 4줄 자동 슬라이드(마퀴, 줄마다 방향 교차) + 카드 크기 통일
    if (!s.migrations.logoMarqueeV1) {
      const nowLM = new Date().toISOString();
      s.pages.forEach(pg => {
        if (!Array.isArray(pg.sections)) return;
        pg.sections.forEach(sec => {
          if ((sec.html || '').indexOf('class="pst2"') !== -1) {
            const key = pg.id + ':' + sec.id;
            s.history[key] = s.history[key] || [];
            s.history[key].unshift({
              name: sec.name, html: sec.html, note: sec.note || '',
              reason: '협력사 로고 — 정적 그리드 → 4줄 무한 자동 슬라이드(1·3줄 오른쪽, 2·4줄 왼쪽), 카드 크기·로고 통일',
              kind: 'auto-migration', savedAt: nowLM,
            });
            sec.html = POUR_STATS_NATIVE_HTML;
            sec.statusAt = nowLM;
          }
        });
      });
      s.migrations.logoMarqueeV1 = true;
    }
    // 마스코트 이미지 재연결 — 스토리지 '마스코트' 폴더로 이동된 비버 캐릭터 4종 경로 갱신
    // (1 검색요정 nukki / 2 검색 헬퍼·3 퀵배너 gown-circle / 4 플로팅 FAB doctor-gown)
    if (!s.migrations.mascotRelinkV1) {
      const nowMR = new Date().toISOString();
      const reswapMR = (matchClass, html, reason) => {
        s.pages.forEach(pg => {
          if (!Array.isArray(pg.sections)) return;
          pg.sections.forEach(sec => {
            if ((sec.html || '').indexOf(matchClass) !== -1) {
              const key = pg.id + ':' + sec.id;
              s.history[key] = s.history[key] || [];
              s.history[key].unshift({
                name: sec.name, html: sec.html, note: sec.note || '',
                reason, kind: 'auto-migration', savedAt: nowMR,
              });
              sec.html = html;
              sec.statusAt = nowMR;
            }
          });
        });
      };
      reswapMR('class="psm1"', OHOUSE_V1_SECTION_HTML, '마스코트 재연결 — 검색바 요정/헬퍼 캐릭터 이미지 경로를 스토리지 마스코트 폴더로 갱신');
      reswapMR('class="pdq"', POUR_DR_QUICK_BANNER_HTML, '마스코트 재연결 — POUR닥터 퀵배너 캐릭터 이미지 경로를 스토리지 마스코트 폴더로 갱신');
      reswapMR('class="pdfab"', POUR_DR_FAB_HTML, '마스코트 재연결 — POUR닥터 플로팅 FAB 캐릭터 이미지 경로를 스토리지 마스코트 폴더로 갱신');
      s.migrations.mascotRelinkV1 = true;
    }
    return s;
  }
  function mergeDefaultSeeds(s) {
    const defaults = DEFAULT_PAGES();
    defaults.forEach(dp => {
      const existing = s.pages.find(p => p.id === dp.id);
      if (!existing) { s.pages.push(dp); return; }
      if (existing.sections.length === 0) existing.sections = dp.sections;
    });
  }
  function saveState() {
    // 1) localStorage 즉시 (오프라인 복구용)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[builder] localStorage 저장 실패:', e);
    }
    // 2) Firestore 디바운스 푸시
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(pushToFirestore, SAVE_DEBOUNCE_MS);
    setSync('syncing', '저장 대기...');
  }

  function setSync(kind, text) {
    const pill = document.getElementById('syncPill');
    const txt = document.getElementById('syncText');
    if (!pill || !txt) return;
    pill.className = 'sync-pill ' + (kind || '');
    txt.textContent = text || '';
  }

  function newWriteToken() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function initFirebase() {
    if (typeof firebase === 'undefined') {
      setSync('offline', 'Firebase SDK 로드 실패');
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      firebaseReady = true;
      setSync('syncing', '서버 연결 중...');
      db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC)
        .onSnapshot({ includeMetadataChanges: false }, onRemoteSnapshot, onRemoteError);
    } catch (e) {
      console.error('[firebase] 초기화 실패:', e);
      setSync('error', 'Firebase 초기화 실패');
    }
  }

  function onRemoteSnapshot(snap) {
    if (!snap.exists) {
      // 서버에 데이터 없음 → 현재 로컬 상태로 시드
      console.log('[firestore] 문서 없음 → 로컬 상태로 시드');
      initialSnapshotConsumed = true;
      if (!firstSnapshotLoaded) {
        firstSnapshotLoaded = true;
        handleInitialHistoryLoad(state.history || {});
      }
      pushToFirestore(true);
      return;
    }
    const data = snap.data() || {};
    // state 필드(인라인) 도 없고 청크(chunked) 도 아니면 빈 문서로 간주
    if (!data.state && !data.chunked) {
      initialSnapshotConsumed = true;
      if (!firstSnapshotLoaded) {
        firstSnapshotLoaded = true;
        handleInitialHistoryLoad(state.history || {});
      }
      pushToFirestore(true);
      return;
    }
    // 자기 자신이 쓴 echo는 무시
    if (data.lastWrite && data.lastWrite === state.lastWrite) {
      setSync('synced', '동기화됨 ' + fmtTime(new Date()));
      initialSnapshotConsumed = true;
      return;
    }
    // 인라인 또는 청크에서 state 문자열을 확보한 뒤 적용 (청크는 비동기 로드)
    readStateString(data)
      .then(stateStr => {
        if (!stateStr) throw new Error('빈 상태 문자열');
        applyRemoteStateStr(stateStr);
      })
      .catch(e => {
        console.error('[firestore] 원격 상태 적용 실패:', e);
        setSync('error', '원격 데이터 형식 오류');
      });
  }

  function applyRemoteStateStr(stateStr) {
    const remote = JSON.parse(stateStr);
    if (!remote || !Array.isArray(remote.pages)) throw new Error('형식 오류');
    const previousActive = state.activePageId;
    const previousHistory = state.history; // 메모리 history 보존 — 서브컬렉션이 단일 진실
    state = migrate(remote);
    const addedPages = addMissingDefaultPages(state); // 새 기본 페이지(parentHint 포함) 자동 추가
    // 원격 state에 history가 포함돼 있으면 마이그레이션 후보 (legacy)
    const embeddedFromRemote = (remote.history && typeof remote.history === 'object') ? remote.history : null;
    // history는 서브컬렉션에서 로드됨 — 직전 메모리 값 우선 유지
    state.history = previousHistory || state.history || {};
    if (previousActive && state.pages.some(p => p.id === previousActive)) {
      state.activePageId = previousActive;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    renderAll();
    setSync('synced', initialSnapshotConsumed ? ('실시간 반영 ' + fmtTime(new Date())) : ('서버에서 불러옴 ' + fmtTime(new Date())));
    initialSnapshotConsumed = true;
    if (!firstSnapshotLoaded) {
      firstSnapshotLoaded = true;
      handleInitialHistoryLoad(embeddedFromRemote || state.history || {});
    }
    if (addedPages > 0) {
      console.log(`[builder] ${addedPages}개 신규 기본 페이지 추가 → 저장`);
      saveState(); // 디바운스 저장 — 새 기본 페이지 영구 반영
    }
  }

  function onRemoteError(err) {
    console.error('[firestore] onSnapshot 오류:', err);
    setSync('error', '동기화 오류 — ' + (err.code || err.message || ''));
  }

  function pushToFirestore(silent) {
    if (!firebaseReady || !db) { setSync('offline', '오프라인 — 로컬에만 저장됨'); return; }
    state.lastWrite = newWriteToken();
    if (!silent) setSync('syncing', '저장 중...');
    // history는 서브컬렉션(pourstore-renewal-builder/state/history)에서 관리 →
    // 메인 state 직렬화 시 분리하여 1MB 한도 회피
    const stateForFirestore = Object.assign({}, state);
    delete stateForFirestore.history;
    const stateStr = JSON.stringify(stateForFirestore);
    const lastWrite = state.lastWrite;
    writeStateDoc(stateStr, lastWrite)
      .then(() => {
        setSync('synced', '저장됨 ' + fmtTime(new Date()));
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
      })
      .catch(e => {
        console.error('[firestore] 저장 실패:', e);
        setSync('error', '서버 저장 실패: ' + (e.code || e.message || ''));
        toast('서버 저장 실패: ' + (e.code || e.message || ''), 'error');
      });
  }

  // ─────────────────────────────────────────────
  // State 청크 분산 저장 — 메인 state JSON 이 1MB 한도를 넘을 때
  // pourstore-renewal-builder/state/state-chunks/{seq} 로 쪼개 저장
  // 메인 doc: { chunked:true, chunkCount:N, lastWrite, updatedAt } (state 필드 없음)
  // ─────────────────────────────────────────────
  function stateChunkColRef() {
    return db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC).collection(STATE_CHUNK_SUBCOL);
  }
  function byteLength(str) {
    try { return new TextEncoder().encode(str).length; }
    catch (_) { return str.length * 3; } // 폴백 — 한글 기준 보수적 추정
  }
  // keepCount 이상 인덱스의 잔여 청크 문서를 정리 (best-effort)
  function cleanupStateChunks(keepCount) {
    if (!firebaseReady || !db) return;
    stateChunkColRef().get().then(snap => {
      const stale = [];
      snap.forEach(doc => {
        const idx = parseInt(doc.id, 10);
        if (!isNaN(idx) && idx >= keepCount) stale.push(doc.ref);
      });
      for (let i = 0; i < stale.length; i += HISTORY_BATCH_LIMIT) {
        const batch = db.batch();
        stale.slice(i, i + HISTORY_BATCH_LIMIT).forEach(ref => batch.delete(ref));
        batch.commit().catch(e => console.error('[state-chunk] 잔여 청크 삭제 실패:', e));
      }
    }).catch(e => console.error('[state-chunk] 정리 조회 실패:', e));
  }
  async function writeStateDoc(stateStr, lastWrite) {
    const docRef = db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC);
    const updatedAt = new Date().toISOString();
    // 1) 한도 이내 → 기존 방식대로 인라인 저장
    if (byteLength(stateStr) <= STATE_INLINE_MAX_BYTES) {
      await docRef.set({ state: stateStr, chunked: false, chunkCount: 0, lastWrite, updatedAt }, { merge: false });
      // 직전에 청크가 있었을 때만(또는 미상일 때 1회) 잔여 청크 정리 — 매 저장 조회 방지
      if (lastKnownChunkCount === null || lastKnownChunkCount > 0) cleanupStateChunks(0);
      lastKnownChunkCount = 0;
      return;
    }
    // 2) 한도 초과 → 청크 분산 저장 (청크 먼저, 메인 doc 마지막)
    const chunks = [];
    for (let i = 0; i < stateStr.length; i += STATE_CHUNK_CHARS) {
      chunks.push(stateStr.slice(i, i + STATE_CHUNK_CHARS));
    }
    const colRef = stateChunkColRef();
    for (let i = 0; i < chunks.length; i += HISTORY_BATCH_LIMIT) {
      const batch = db.batch();
      chunks.slice(i, i + HISTORY_BATCH_LIMIT).forEach((c, j) => {
        batch.set(colRef.doc(String(i + j)), { seq: i + j, data: c });
      });
      await batch.commit();
    }
    // 메인 doc 은 마지막에 — state 필드 제거(merge:false), chunked 메타만 기록
    await docRef.set({ chunked: true, chunkCount: chunks.length, lastWrite, updatedAt }, { merge: false });
    // 청크 수가 줄었을 때만 잔여 청크 정리
    if (lastKnownChunkCount === null || lastKnownChunkCount > chunks.length) cleanupStateChunks(chunks.length);
    lastKnownChunkCount = chunks.length;
    console.log(`[state-chunk] ${chunks.length}개 청크로 분산 저장 (${byteLength(stateStr)} bytes)`);
  }
  async function readStateString(data) {
    // 원격 청크 개수 추적 — 이후 저장 시 잔여 청크 정리 판단에 사용
    lastKnownChunkCount = (data && data.chunked) ? (data.chunkCount || 0) : 0;
    if (data && data.chunked) {
      const snap = await stateChunkColRef().get();
      const arr = [];
      snap.forEach(doc => {
        const x = doc.data() || {};
        const seq = (typeof x.seq === 'number') ? x.seq : parseInt(doc.id, 10);
        if (typeof x.data === 'string' && !isNaN(seq)) arr[seq] = x.data;
      });
      console.log(`[state-chunk] ${snap.size}개 청크 로드 → 재조합`);
      return arr.join('');
    }
    return (data && data.state) || '';
  }

  // ─────────────────────────────────────────────
  // History 서브컬렉션 — 1MB 한도 회피를 위해 메인 state에서 분리
  // 컬렉션 경로: pourstore-renewal-builder/state/history/{safeKey}
  // 각 doc: { versions: [...], updatedAt }
  // ─────────────────────────────────────────────
  function safeKey(k) { return String(k).replace(/:/g, '__'); }
  function unsafeKey(id) { return String(id).replace(/__/g, ':'); }
  function historyColRef() {
    return db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC).collection(HISTORY_SUBCOL);
  }
  function persistHistory(k) {
    if (!firebaseReady || !db) return;
    if (historyWriteTimers[k]) clearTimeout(historyWriteTimers[k]);
    historyWriteTimers[k] = setTimeout(() => {
      delete historyWriteTimers[k];
      const versions = state.history[k];
      const ref = historyColRef().doc(safeKey(k));
      if (!versions || versions.length === 0) {
        ref.delete().catch(e => console.error('[history-persist] 삭제 실패:', k, e));
      } else {
        ref.set({ versions, updatedAt: new Date().toISOString() })
          .catch(e => console.error('[history-persist] 저장 실패:', k, e));
      }
    }, SAVE_DEBOUNCE_MS);
  }
  async function loadHistorySubcollection() {
    if (!firebaseReady || !db) return {};
    try {
      const snap = await historyColRef().get();
      const out = {};
      snap.forEach(doc => {
        const data = doc.data() || {};
        if (Array.isArray(data.versions)) out[unsafeKey(doc.id)] = data.versions;
      });
      console.log(`[history] 서브컬렉션 ${snap.size}개 키 로드`);
      return out;
    } catch (e) {
      console.error('[history] 서브컬렉션 로드 실패:', e);
      return {};
    }
  }
  async function migrateHistoryToSubcollection(map) {
    if (!firebaseReady || !db) return 0;
    const keys = Object.keys(map || {});
    if (keys.length === 0) return 0;
    let written = 0;
    for (let i = 0; i < keys.length; i += HISTORY_BATCH_LIMIT) {
      const chunk = keys.slice(i, i + HISTORY_BATCH_LIMIT);
      const batch = db.batch();
      chunk.forEach(k => {
        const versions = map[k];
        if (!Array.isArray(versions) || versions.length === 0) return;
        batch.set(historyColRef().doc(safeKey(k)), { versions, updatedAt: new Date().toISOString() });
        written++;
      });
      try { await batch.commit(); }
      catch (e) { console.error('[history-migrate] batch 실패:', e); throw e; }
    }
    console.log(`[history-migrate] ${written}개 키 마이그레이션 완료`);
    return written;
  }
  async function handleInitialHistoryLoad(embeddedHistory) {
    // 1) 서브컬렉션 로드 — 이미 마이그레이션된 데이터
    const sub = await loadHistorySubcollection();
    // 2) 내장 history 중 서브컬렉션에 없는 키만 마이그레이션 대상
    const embedded = (embeddedHistory && typeof embeddedHistory === 'object') ? embeddedHistory : {};
    const toMigrate = {};
    Object.keys(embedded).forEach(k => {
      if (!sub[k] && Array.isArray(embedded[k]) && embedded[k].length > 0) toMigrate[k] = embedded[k];
    });
    // 3) 메모리 state.history = 서브컬렉션 + 마이그레이션 후보
    state.history = Object.assign({}, sub, toMigrate);
    // 4) 마이그레이션 실행
    if (Object.keys(toMigrate).length > 0) {
      try {
        await migrateHistoryToSubcollection(toMigrate);
        toast(`수정 이력 ${Object.keys(toMigrate).length}개 안전하게 분리 저장 완료`, 'success');
        // 메인 doc 재저장 — history 분리된 상태로 덮어씀 (이미 pushToFirestore에서 자동 분리)
        pushToFirestore(true);
      } catch (e) {
        toast('이력 마이그레이션 실패: ' + (e.code || e.message || ''), 'error');
      }
    }
    // 5) 화면 갱신
    try { renderSections(); } catch (_) {}
    try { if (historyCtx) renderHistoryList(); } catch (_) {}
    try { checkOldHistoryAndNotify(); } catch (_) {}
  }

  function fmtTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // -------- 1년 경과 이력 수동 정리 --------
  // 규칙: 각 섹션의 idx 0(=가장 최근 이력 = 직전 버전)은 절대 삭제 후보에 포함하지 않는다.
  function findOldHistoryEntries() {
    const cutoff = Date.now() - ONE_YEAR_MS;
    const items = [];
    Object.keys(state.history || {}).forEach(k => {
      const list = state.history[k] || [];
      // idx 0 = 직전 버전, 삭제 불가 → 1부터 시작
      for (let i = 1; i < list.length; i++) {
        const v = list[i];
        if (!v || !v.savedAt) continue;
        const t = new Date(v.savedAt).getTime();
        if (isFinite(t) && t < cutoff) items.push({ key: k, idx: i, version: v });
      }
    });
    return items;
  }

  function describeKey(k) {
    const [pageId, secId] = k.split(':');
    const page = state.pages.find(p => p.id === pageId);
    const sec = page && page.sections.find(s => s.id === secId);
    return {
      pageName: page ? page.name : '(삭제된 페이지)',
      secName: sec ? sec.name : '(삭제된 섹션)',
    };
  }

  function checkOldHistoryAndNotify() {
    const banner = document.getElementById('retentionBanner');
    if (!banner) return;
    if (sessionStorage.getItem('retentionDismissed') === '1') { banner.style.display = 'none'; return; }
    const old = findOldHistoryEntries();
    if (old.length === 0) { banner.style.display = 'none'; return; }
    document.getElementById('retentionCount').textContent = old.length;
    banner.style.display = 'flex';
  }

  function openRetention() {
    const old = findOldHistoryEntries();
    const wrap = document.getElementById('rmList');
    wrap.innerHTML = '';
    if (old.length === 0) {
      wrap.innerHTML = '<div class="empty-history">1년 이상 보관된 이력이 없습니다. 모두 안전 보관 중입니다.</div>';
      openModal('retentionModal');
      return;
    }
    const grouped = {};
    old.forEach(it => {
      if (!grouped[it.key]) grouped[it.key] = [];
      grouped[it.key].push(it);
    });
    Object.keys(grouped).forEach(k => {
      const desc = describeKey(k);
      const items = grouped[k];
      const block = document.createElement('div');
      block.className = 'retention-group';
      const head = document.createElement('div');
      head.className = 'rg-head';
      head.innerHTML = `<span>${escapeHtml(desc.pageName)} · ${escapeHtml(desc.secName)}</span><span class="rg-count">${items.length}건</span>`;
      block.appendChild(head);
      items.forEach(it => {
        const v = it.version;
        const row = document.createElement('label');
        row.className = 'rg-item';
        row.innerHTML = `
          <input type="checkbox" data-key="${escapeHtml(it.key)}" data-idx="${it.idx}" />
          <span class="rg-when">${fmtDate(v.savedAt)}</span>
          <span class="rg-reason ${v.reason ? '' : 'empty'}">${escapeHtml(v.reason || '(사유 없음)')}</span>
        `;
        block.appendChild(row);
      });
      wrap.appendChild(block);
    });
    document.getElementById('rmSelectAll').checked = false;
    openModal('retentionModal');
  }

  function deleteSelectedRetention() {
    const checks = document.querySelectorAll('#rmList input[type=checkbox]:checked');
    if (checks.length === 0) { toast('삭제할 항목을 선택하세요.', 'error'); return; }
    if (!confirm(`${checks.length}개 이력을 영구 삭제할까요? 복구할 수 없습니다.\n\n참고: 각 섹션의 직전 버전은 자동 보호되어 목록에 포함되지 않습니다.`)) return;
    const byKey = {};
    checks.forEach(c => {
      const key = c.dataset.key;
      const idx = parseInt(c.dataset.idx, 10);
      if (idx === 0) return; // 안전장치: 직전 버전 보호
      (byKey[key] = byKey[key] || []).push(idx);
    });
    let removed = 0;
    const affectedKeys = [];
    Object.keys(byKey).forEach(k => {
      const idxs = byKey[k].sort((a, b) => b - a);
      const list = state.history[k];
      if (!list) return;
      idxs.forEach(i => { if (i > 0 && i < list.length) { list.splice(i, 1); removed++; } });
      if (list.length === 0) delete state.history[k];
      affectedKeys.push(k);
    });
    saveState();
    affectedKeys.forEach(persistHistory); // 서브컬렉션에 반영 (빈 키는 삭제됨)
    closeModal('retentionModal');
    checkOldHistoryAndNotify();
    toast(`${removed}건 영구 삭제됨`, 'info');
  }

  function getActivePage() {
    // 활성 항목이 폴더면 첫 번째 페이지로 폴백
    let p = state.pages.find(p => p.id === state.activePageId);
    if (p && p.type !== 'folder') return p;
    return state.pages.find(x => x.type !== 'folder') || state.pages[0];
  }
  function getActiveNode() {
    // 폴더든 페이지든 그대로 반환 (사이드바 선택 상태 표시용)
    return state.pages.find(p => p.id === state.activePageId) || null;
  }
  function getChildren(parentId) {
    return state.pages.filter(p => (p.parentId || null) === (parentId || null));
  }
  function getDepth(nodeId) {
    let d = 0, id = nodeId;
    while (id) {
      const node = state.pages.find(p => p.id === id);
      if (!node || !node.parentId) return d;
      id = node.parentId;
      d++;
      if (d > 10) return d; // 안전장치
    }
    return d;
  }
  function maxSubtreeDepth(nodeId) {
    const children = getChildren(nodeId);
    if (children.length === 0) return 0;
    return 1 + Math.max.apply(null, children.map(c => maxSubtreeDepth(c.id)));
  }
  function isDescendant(maybeAncestorId, nodeId) {
    let id = nodeId;
    while (id) {
      if (id === maybeAncestorId) return true;
      const node = state.pages.find(p => p.id === id);
      if (!node) return false;
      id = node.parentId;
    }
    return false;
  }
  function canMoveTo(nodeId, newParentId) {
    if (nodeId === newParentId) return false;
    if (newParentId && isDescendant(nodeId, newParentId)) return false; // 후손에게 이동 불가
    const newParentDepth = newParentId ? getDepth(newParentId) : -1;
    const sub = maxSubtreeDepth(nodeId);
    return (newParentDepth + 1 + sub) < MAX_DEPTH; // 0,1,2 허용 → < 3
  }
  function canAddFolderUnder(parentId) {
    const parentDepth = parentId ? getDepth(parentId) : -1;
    return parentDepth + 1 <= 1; // 폴더는 depth 0 또는 1까지만
  }
  function canAddPageUnder(parentId) {
    const parentDepth = parentId ? getDepth(parentId) : -1;
    return parentDepth + 1 <= 2; // 페이지는 depth 0,1,2 허용
  }

  // 폴더 접힘 상태 — 기기별 localStorage
  function loadCollapsed() {
    try {
      const raw = localStorage.getItem(FOLDER_COLLAPSE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) { return new Set(); }
  }
  let collapsedFolders = loadCollapsed();
  function saveCollapsed() {
    try { localStorage.setItem(FOLDER_COLLAPSE_KEY, JSON.stringify(Array.from(collapsedFolders))); } catch (_) {}
  }
  function toggleFolder(id) {
    if (collapsedFolders.has(id)) collapsedFolders.delete(id);
    else collapsedFolders.add(id);
    saveCollapsed();
    renderPages();
  }
  function depthLabel(d) { return ['대분류','중분류','소분류'][d] || ('Lv.' + (d+1)); }
  function getSection(pageId, secId) {
    const p = state.pages.find(x => x.id === pageId);
    return p ? p.sections.find(s => s.id === secId) : null;
  }
  function histKey(pageId, secId) { return pageId + ':' + secId; }
  function pushHistory(pageId, secId, snapshot) {
    const k = histKey(pageId, secId);
    const list = state.history[k] || [];
    list.unshift(snapshot);
    // 자동 삭제 없음 — 모든 버전 영구 보관 (1년 경과 시 수동 정리 알림만 띄움)
    state.history[k] = list;
    persistHistory(k); // 서브컬렉션에 디바운스 저장
  }

  // -------- rendering --------
  function renderAll() {
    if (checkShareLinkMode()) return; // 공유 링크 모드면 빌더 UI 렌더 안함
    purgeOldTrash(); // 7일 경과 휴지통 항목 자동 영구 삭제
    renderPages();
    renderSections();
    renderMeCard();
    updatePageFeedbackCount();
    updateTrashCount();
    checkOldHistoryAndNotify();
  }

  function renderPages() {
    const list = document.getElementById('pageList');
    list.innerHTML = '';
    const renderNode = (node, depth) => {
      const item = document.createElement('div');
      const isFolder = node.type === 'folder';
      const isActive = node.id === state.activePageId;
      const isCollapsed = isFolder && collapsedFolders.has(node.id);
      item.className = 'page-item depth-' + depth + (isActive ? ' active' : '') + (isFolder ? ' is-folder' : ' is-page');
      item.dataset.nodeId = node.id;
      const childCount = isFolder ? getChildren(node.id).length : 0;
      const secCount = isFolder ? '' : `<span class="count">${node.sections.length}</span>`;
      const dlabel = depthLabel(depth);
      const pageStatus = node.pageStatus === 'wip' ? 'wip' : 'draft';
      const dotTitle = pageStatus === 'wip' ? '진행중 — 클릭하여 초안으로 변경' : '초안 — 클릭하여 진행중으로 변경';
      item.innerHTML = `
        <div class="name">
          <span class="grip" title="드래그해서 이동/순서변경">⋮⋮</span>
          ${isFolder ? `<span class="caret" title="${isCollapsed ? '펼치기' : '접기'}">${isCollapsed ? '▶' : '▼'}</span>` : '<span class="caret-spacer"></span>'}
          <span class="page-status-dot status-${pageStatus}" data-act="toggle-status" title="${dotTitle}" role="button" aria-label="${dotTitle}"></span>
          <span class="icon">${isFolder ? '📁' : '📄'}</span>
          <span class="title" title="${escapeHtml(dlabel)} · ${escapeHtml(node.name)}">${escapeHtml(node.name)}</span>
          ${isFolder ? `<span class="folder-meta">${childCount}</span>` : secCount}
        </div>
      `;
      const dot = item.querySelector('[data-act=toggle-status]');
      if (dot) {
        dot.addEventListener('click', e => {
          e.stopPropagation();
          togglePageStatus(node.id);
        });
      }
      item.addEventListener('click', e => {
        if (e.target.closest('[data-act=toggle-status]')) return;
        if (isFolder) {
          // 폴더는 caret 클릭 = 토글, 본문 클릭 = 선택만 + 토글
          toggleFolder(node.id);
          state.activePageId = node.id;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
          renderPages();
        } else {
          state.activePageId = node.id;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
          renderAll();
        }
      });
      attachPageDnd(item, node);
      list.appendChild(item);
      if (isFolder && !isCollapsed) {
        getChildren(node.id).forEach(c => renderNode(c, depth + 1));
      }
    };
    getChildren(null).forEach(r => renderNode(r, 0));
    if (state.pages.length === 0) {
      list.innerHTML = '<div class="empty-pages">아직 등록된 페이지/폴더가 없습니다.<br/>아래 <b>+ 페이지</b> 또는 <b>+ 폴더</b> 버튼으로 시작하세요.</div>';
    }
  }

  function togglePageStatus(nodeId) {
    const node = state.pages.find(p => p.id === nodeId);
    if (!node) return;
    const next = node.pageStatus === 'wip' ? 'draft' : 'wip';
    node.pageStatus = next;
    saveState();
    renderPages();
    toast(next === 'wip' ? '진행중으로 변경' : '초안으로 변경', 'success');
  }

  // -------- 사이드바 DnD (페이지/폴더 순서 변경) --------
  let pageDragSrcId = null;
  function attachPageDnd(item, node) {
    item.draggable = true;
    item.addEventListener('dragstart', e => {
      pageDragSrcId = node.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', node.id); } catch (_) {}
    });
    item.addEventListener('dragend', () => {
      document.querySelectorAll('.page-item').forEach(el => {
        el.classList.remove('dragging','dnd-before','dnd-after','dnd-inside');
        delete el.dataset.dropPos;
      });
      pageDragSrcId = null;
    });
    item.addEventListener('dragover', e => {
      if (!pageDragSrcId || pageDragSrcId === node.id) return;
      const isFolder = node.type === 'folder';
      const rect = item.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height;
      let pos;
      if (isFolder && y > h * 0.25 && y < h * 0.75) pos = 'inside';
      else if (y < h / 2) pos = 'before';
      else pos = 'after';
      const valid = (pos === 'inside')
        ? canMoveTo(pageDragSrcId, node.id)
        : canMoveTo(pageDragSrcId, node.parentId || null);
      item.classList.remove('dnd-before','dnd-after','dnd-inside');
      if (!valid) { e.dataTransfer.dropEffect = 'none'; return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('dnd-' + pos);
      item.dataset.dropPos = pos;
    });
    item.addEventListener('dragleave', () => {
      item.classList.remove('dnd-before','dnd-after','dnd-inside');
      delete item.dataset.dropPos;
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      const pos = item.dataset.dropPos;
      item.classList.remove('dnd-before','dnd-after','dnd-inside');
      delete item.dataset.dropPos;
      if (!pageDragSrcId || pageDragSrcId === node.id || !pos) { pageDragSrcId = null; return; }
      const ok = dropPageAt(pageDragSrcId, node.id, pos);
      pageDragSrcId = null;
      if (ok) {
        saveState();
        renderAll();
        toast('이동됨', 'success');
      } else {
        toast('이동 불가 (깊이 초과 또는 자기 자신·후손)', 'error');
      }
    });
  }
  function dropPageAt(srcId, targetId, position) {
    const src = state.pages.find(p => p.id === srcId);
    const target = state.pages.find(p => p.id === targetId);
    if (!src || !target || src.id === target.id) return false;
    let newParentId;
    if (position === 'inside') {
      if (target.type !== 'folder') return false;
      if (!canMoveTo(srcId, targetId)) return false;
      newParentId = targetId;
    } else {
      newParentId = target.parentId || null;
      if (!canMoveTo(srcId, newParentId)) return false;
    }
    // state.pages 배열에서 src를 제거 후 적절한 위치에 재삽입
    const srcIdx = state.pages.findIndex(p => p.id === srcId);
    if (srcIdx < 0) return false;
    state.pages.splice(srcIdx, 1);
    src.parentId = newParentId;
    const targetIdx = state.pages.findIndex(p => p.id === targetId);
    let insertIdx;
    if (position === 'before') {
      insertIdx = targetIdx;
    } else if (position === 'after') {
      insertIdx = targetIdx + 1;
    } else {
      // inside — 폴더 자식들의 마지막 다음 위치에 삽입
      let lastChildIdx = -1;
      state.pages.forEach((p, i) => { if (p.parentId === targetId) lastChildIdx = i; });
      insertIdx = lastChildIdx >= 0 ? lastChildIdx + 1 : targetIdx + 1;
      // 새로 들어가는 부모의 접힘 상태는 펼침
      if (collapsedFolders.has(targetId)) { collapsedFolders.delete(targetId); saveCollapsed(); }
    }
    state.pages.splice(insertIdx, 0, src);
    return true;
  }

  function renderSections() {
    const page = getActivePage();
    document.getElementById('pageTitle').textContent = page.name;
    document.getElementById('pageFile').textContent = '/' + page.file;

    const wrap = document.getElementById('sectionList');
    wrap.innerHTML = '';

    if (page.sections.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-sections';
      empty.innerHTML = '아직 등록된 섹션이 없습니다.<br/>아래 <b>+ 섹션 추가</b> 버튼을 눌러 첫 섹션을 만들어 주세요.';
      wrap.appendChild(empty);
      return;
    }

    page.sections.forEach((s, idx) => {
      const card = document.createElement('div');
      const cardStatus = s.status || 'draft';
      card.className = 'section-card status-' + cardStatus + (s.hidden ? ' section-hidden' : '');
      card.draggable = true;
      card.dataset.sectionId = s.id;
      const hasHtml = s.html && s.html.trim().length > 0;
      const histLen = (state.history[histKey(page.id, s.id)] || []).length;
      const fbCount = (s.feedbacks || []).length;
      const meta = STATUS_META[s.status];
      const pillText = meta ? `${meta.icon} ${meta.label}` : '◌ 초안';
      const statusTitle = s.statusAt ? `${statusLabel(s.status)} (${fmtDate(s.statusAt)})` : '상태: 초안';
      card.innerHTML = `
        <div class="grip" title="드래그해서 순서 변경">⋮⋮</div>
        <div class="status-control">
          <button class="status-pill status-${cardStatus}" data-act="status-toggle" title="${escapeHtml(statusTitle)} — 클릭하여 상태 변경" type="button">
            <span class="pill-text">${escapeHtml(pillText)}</span>
            <span class="pill-caret">▾</span>
          </button>
          <div class="status-menu" role="menu">
            <button class="sm-item sm-wip"      data-status="wip"       type="button"><span class="sm-icon">⚙</span> 작업중 <span class="sm-hint">실행자</span></button>
            <button class="sm-item sm-request"  data-status="requested" type="button"><span class="sm-icon">✋</span> 컨펌 요청 <span class="sm-hint">실행자</span></button>
            <button class="sm-item sm-approve"  data-status="approved"  type="button"><span class="sm-icon">✅</span> 승인 완료 <span class="sm-hint">관리자</span></button>
            <button class="sm-item sm-revision" data-status="revision"  type="button"><span class="sm-icon">↻</span> 재수정 요청 <span class="sm-hint">관리자 · 피그마 피드백</span></button>
            <div class="sm-sep"></div>
            <button class="sm-item sm-hide"     data-hide-toggle="1"    type="button"><span class="sm-icon">${s.hidden ? '👁' : '🙈'}</span> ${s.hidden ? '숨김 해제 (미리보기 포함)' : '숨기기 (미리보기·HTML 제외)'}</button>
            <button class="sm-item sm-reset"    data-status=""          type="button"><span class="sm-icon">⊘</span> 초안으로 되돌리기</button>
          </div>
        </div>
        <div class="order">${idx + 1}</div>
        <div class="info">
          <div class="name">
            <span>${escapeHtml(s.name)}</span>
            <span class="badge ${hasHtml ? 'ready' : 'empty'}">${hasHtml ? 'READY' : 'EMPTY'}</span>
            ${histLen ? `<span class="badge">v${histLen}</span>` : ''}
            ${s.hidden ? '<span class="badge badge-hidden">🙈 숨김</span>' : ''}
          </div>
          <div class="meta">${escapeHtml(s.note || '메모 없음')}${s.statusAt ? ` · ${statusLabel(s.status)} ${fmtDate(s.statusAt)}` : ''}</div>
        </div>
        <div class="controls">
          ${hasHtml ? '<button class="btn btn-sm btn-outline" data-act="copy" title="HTML 코드 복사">HTML 복사</button>' : ''}
          ${hasHtml ? '<button class="btn btn-sm btn-outline" data-act="link" title="이 섹션만 보여주는 공유 링크 복사">🔗 링크</button>' : ''}
          <button class="btn btn-sm btn-ghost" data-act="preview">미리보기</button>
          <button class="btn btn-sm btn-outline" data-act="feedback" title="이 섹션에 대한 피드백">💬 ${fbCount}</button>
          <button class="btn btn-sm btn-outline" data-act="history">이력</button>
          <button class="btn btn-sm btn-primary" data-act="edit">편집</button>
          <button class="btn btn-sm btn-danger" data-act="delete" title="삭제">×</button>
        </div>
      `;
      const pill = card.querySelector('[data-act=status-toggle]');
      const menu = card.querySelector('.status-menu');
      pill.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = menu.classList.contains('open');
        closeStatusMenus();
        if (!wasOpen) menu.classList.add('open');
      });
      menu.querySelectorAll('[data-status]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          setSectionStatus(s.id, btn.dataset.status || null);
        });
      });
      const hideBtn = menu.querySelector('[data-hide-toggle]');
      if (hideBtn) hideBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleSectionHidden(s.id);
      });
      const copyBtn = card.querySelector('[data-act=copy]');
      if (copyBtn) copyBtn.addEventListener('click', () => copyHtmlToClipboard(s.html));
      const linkBtn = card.querySelector('[data-act=link]');
      if (linkBtn) linkBtn.addEventListener('click', () => copySectionLink(page.id, s.id));
      card.querySelector('[data-act=preview]').addEventListener('click', () => previewSection(s.id));
      card.querySelector('[data-act=feedback]').addEventListener('click', () => openFeedbackModalForSection(s.id));
      card.querySelector('[data-act=history]').addEventListener('click', () => openHistory(s.id));
      card.querySelector('[data-act=edit]').addEventListener('click', () => openEditor(s.id));
      card.querySelector('[data-act=delete]').addEventListener('click', () => deleteSection(s.id));
      attachDnd(card);
      wrap.appendChild(card);
    });
  }

  // -------- drag & drop --------
  let dragSrcId = null;
  function attachDnd(card) {
    card.addEventListener('dragstart', e => {
      dragSrcId = card.dataset.sectionId;
      card.classList.add('dragging');
      closeStatusMenus();
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragSrcId); } catch (_) {}
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.section-card.drag-over').forEach(c => c.classList.remove('drag-over'));
      dragSrcId = null;
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragSrcId && dragSrcId !== card.dataset.sectionId) card.classList.add('drag-over');
      e.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId = card.dataset.sectionId;
      if (!dragSrcId || dragSrcId === targetId) return;
      reorderSections(dragSrcId, targetId);
    });
  }

  function reorderSections(srcId, targetId) {
    const page = getActivePage();
    const arr = page.sections;
    const fromIdx = arr.findIndex(s => s.id === srcId);
    const toIdx = arr.findIndex(s => s.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    saveState();
    renderSections();
    toast('순서 변경됨', 'info');
  }

  // -------- page / folder CRUD --------
  function preferredParentForNew() {
    // 활성 노드가 폴더면 그 안에 넣기, 페이지면 같은 부모
    const node = getActiveNode();
    if (!node) return null;
    if (node.type === 'folder') return node.id;
    return node.parentId || null;
  }
  function addPage() {
    let parentId = preferredParentForNew();
    if (!canAddPageUnder(parentId)) {
      // 깊이 초과 — 한 단계 위로 폴백
      const node = state.pages.find(p => p.id === parentId);
      parentId = node ? (node.parentId || null) : null;
      if (!canAddPageUnder(parentId)) parentId = null;
    }
    const name = prompt('새 페이지 이름을 입력하세요. (예: 이벤트, FAQ 등)');
    if (!name || !name.trim()) return;
    const fileGuess = prompt('파일명을 입력하세요. (예: event.html)', slug(name) + '.html');
    if (!fileGuess) return;
    const id = 'p-' + Math.random().toString(36).slice(2, 8);
    state.pages.push({ id, name: name.trim(), file: fileGuess.trim(), sections: [], feedbacks: [], parentId, type: 'page' });
    state.activePageId = id;
    saveState();
    renderAll();
    const where = parentId ? ` (${depthLabel(getDepth(parentId) + 1)})` : ' (대분류)';
    toast('페이지 추가됨' + where, 'success');
  }
  function addFolder() {
    let parentId = preferredParentForNew();
    if (!canAddFolderUnder(parentId)) {
      // 폴더는 depth 0,1만 가능. 부모가 너무 깊으면 한 단계 위로
      const node = state.pages.find(p => p.id === parentId);
      parentId = node ? (node.parentId || null) : null;
      if (!canAddFolderUnder(parentId)) parentId = null;
    }
    const dlabel = depthLabel((parentId ? getDepth(parentId) + 1 : 0));
    const name = prompt(`새 ${dlabel} 폴더 이름을 입력하세요.`);
    if (!name || !name.trim()) return;
    const id = 'f-' + Math.random().toString(36).slice(2, 8);
    state.pages.push({ id, name: name.trim(), file: '', sections: [], feedbacks: [], parentId, type: 'folder' });
    if (parentId) collapsedFolders.delete(parentId), saveCollapsed(); // 부모 펼치기
    state.activePageId = id;
    saveState();
    renderAll();
    toast(`${dlabel} 폴더 추가됨`, 'success');
  }
  function renamePage() {
    const node = getActiveNode();
    if (!node) return;
    const isFolder = node.type === 'folder';
    const name = prompt(isFolder ? '폴더 이름' : '페이지 이름', node.name);
    if (!name || !name.trim()) return;
    node.name = name.trim();
    if (!isFolder) {
      const file = prompt('파일명', node.file);
      if (file && file.trim()) node.file = file.trim();
    }
    saveState();
    renderAll();
  }
  function deletePage() {
    const node = getActiveNode();
    if (!node) return;
    const isFolder = node.type === 'folder';
    if (isFolder) {
      const childCount = getChildren(node.id).length;
      if (childCount > 0) {
        toast(`'${node.name}' 폴더 안에 ${childCount}개 항목이 있습니다. 먼저 비우거나 다른 곳으로 이동해 주세요.`, 'error');
        return;
      }
      if (!confirm(`'${node.name}' 폴더를 삭제할까요?`)) return;
    } else {
      // 마지막 페이지는 보호 (폴더 제외 페이지가 1개뿐이면)
      const totalPages = state.pages.filter(p => p.type !== 'folder').length;
      if (totalPages <= 1) { toast('최소 1개 페이지는 유지해야 합니다.', 'error'); return; }
      if (!confirm(`'${node.name}' 페이지를 삭제할까요? 섹션과 이력이 모두 사라집니다.`)) return;
      node.sections.forEach(s => {
        const k = histKey(node.id, s.id);
        delete state.history[k];
        persistHistory(k); // 서브컬렉션에서 빈 상태 → 삭제
      });
    }
    state.pages = state.pages.filter(p => p.id !== node.id);
    state.deletedDefaults = state.deletedDefaults || [];
    if (state.deletedDefaults.indexOf(node.id) === -1) state.deletedDefaults.push(node.id);
    // 활성 전환: 같은 부모의 다른 페이지 → 첫 페이지
    const sibling = getChildren(node.parentId || null).find(x => x.type !== 'folder');
    state.activePageId = sibling ? sibling.id : (state.pages.find(p => p.type !== 'folder') || state.pages[0] || {}).id;
    saveState();
    renderAll();
    toast((isFolder ? '폴더' : '페이지') + ' 삭제됨', 'info');
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || 'page';
  }

  // -------- section CRUD --------
  function addSection() {
    const page = getActivePage();
    const name = prompt('새 섹션 이름', `섹션 ${page.sections.length + 1}`);
    if (!name || !name.trim()) return;
    page.sections.push(mkSec(name.trim(), '', ''));
    saveState();
    renderSections();
    toast('섹션 추가됨', 'success');
  }
  function deleteSection(secId) {
    const page = getActivePage();
    const sec = getSection(page.id, secId);
    if (!sec) return;
    if (!confirm(`'${sec.name}' 섹션을 삭제할까요? 이 섹션의 이력도 모두 사라집니다.`)) return;
    page.sections = page.sections.filter(s => s.id !== secId);
    const delKey = histKey(page.id, secId);
    delete state.history[delKey];
    persistHistory(delKey); // 서브컬렉션에서 삭제
    saveState();
    renderSections();
    toast('섹션 삭제됨', 'info');
  }
  function setSectionStatus(secId, newStatus) {
    const page = getActivePage();
    const sec = getSection(page.id, secId);
    if (!sec) return;
    if ((sec.status || null) === (newStatus || null)) {
      closeStatusMenus();
      return;
    }
    const fromLabel = statusLabel(sec.status);
    const toLabel = statusLabel(newStatus);
    let reason, kind, toastMsg, toastType;
    if (newStatus === 'wip') {
      reason = `작업중 표시 (이전: ${fromLabel})`;
      kind = 'wip';
      toastMsg = '작업중으로 표시됨';
      toastType = 'info';
    } else if (newStatus === 'requested') {
      reason = `컨펌 요청 (이전: ${fromLabel})`;
      kind = 'request';
      toastMsg = '컨펌 요청으로 표시됨';
      toastType = 'info';
    } else if (newStatus === 'approved') {
      reason = `승인 완료 (이전: ${fromLabel})`;
      kind = 'approve';
      toastMsg = '승인 완료로 표시됨';
      toastType = 'success';
    } else if (newStatus === 'revision') {
      reason = `재수정 요청 — 피드백은 피그마 참조 (이전: ${fromLabel})`;
      kind = 'revision';
      toastMsg = '재수정 요청으로 표시됨';
      toastType = 'error';
    } else {
      reason = `상태 초기화 (이전: ${fromLabel})`;
      kind = 'reset-status';
      toastMsg = '초안 상태로 되돌림';
      toastType = 'info';
    }
    pushHistory(page.id, sec.id, {
      name: sec.name, html: sec.html, note: sec.note,
      reason, kind, savedAt: nowIso(),
    });
    sec.status = newStatus || null;
    sec.statusAt = newStatus ? nowIso() : null;
    // 하위 호환 필드도 업데이트
    sec.confirmed = (newStatus === 'approved');
    sec.confirmedAt = sec.confirmed ? sec.statusAt : null;
    saveState();
    closeStatusMenus();
    renderSections();
    toast(`[${sec.name}] → ${toLabel} · ${toastMsg}`, toastType);
  }
  function toggleSectionHidden(secId) {
    const page = getActivePage();
    const sec = page.sections.find(x => x.id === secId);
    if (!sec) return;
    sec.hidden = !sec.hidden;
    saveState();
    closeStatusMenus();
    renderSections();
    toast(sec.hidden ? `[${sec.name}] 숨김 — 미리보기·HTML에서 제외됩니다` : `[${sec.name}] 숨김 해제`, 'info');
  }
  function closeStatusMenus() {
    document.querySelectorAll('.status-menu.open').forEach(m => m.classList.remove('open'));
  }

  // -------- editor modal --------
  let editorCtx = null;
  function openEditor(secId) {
    const page = getActivePage();
    const sec = getSection(page.id, secId);
    if (!sec) return;
    editorCtx = { pageId: page.id, secId, snapshot: { name: sec.name, html: sec.html, note: sec.note } };
    document.getElementById('edTitle').textContent = `섹션 편집 — ${sec.name}`;
    document.getElementById('edName').value = sec.name;
    document.getElementById('edNote').value = sec.note || '';
    document.getElementById('edHtml').value = sec.html || '';
    const rEl = document.getElementById('edReason');
    rEl.value = '';
    rEl.classList.remove('required-empty');
    renderEditorRoleBar();
    refreshEditorPreview();
    openModal('editorModal');
    setTimeout(() => document.getElementById('edHtml').focus(), 60);
  }
  function refreshEditorPreview() {
    const html = document.getElementById('edHtml').value;
    const frame = document.getElementById('edPreview');
    frame.srcdoc = wrapPreview(html);
  }
  function saveEditor() {
    if (!editorCtx) return;
    const sec = getSection(editorCtx.pageId, editorCtx.secId);
    if (!sec) return;
    const newName = document.getElementById('edName').value.trim() || sec.name;
    const newNote = document.getElementById('edNote').value;
    const newHtml = document.getElementById('edHtml').value;
    const reasonEl = document.getElementById('edReason');
    const reason = reasonEl.value.trim();
    const changed = (newName !== sec.name) || (newNote !== sec.note) || (newHtml !== sec.html);
    if (!changed) { closeModal('editorModal'); toast('변경 없음', 'info'); return; }
    if (!reason) {
      reasonEl.classList.add('required-empty');
      reasonEl.focus();
      toast('변경 사유를 입력해 주세요.', 'error');
      return;
    }
    reasonEl.classList.remove('required-empty');
    pushHistory(editorCtx.pageId, editorCtx.secId, {
      name: sec.name, html: sec.html, note: sec.note,
      reason, kind: 'edit', savedAt: nowIso(),
    });
    sec.name = newName; sec.note = newNote; sec.html = newHtml;
    saveState();
    closeModal('editorModal');
    renderSections();
    toast('저장됨 — 이전 버전은 이력에 보관', 'success');
  }

  // -------- history modal --------
  let historyCtx = null;
  function openHistory(secId) {
    const page = getActivePage();
    const sec = getSection(page.id, secId);
    if (!sec) return;
    historyCtx = { pageId: page.id, secId };
    document.getElementById('hsTitle').textContent = `수정 이력 — ${sec.name}`;
    renderHistoryList();
    openModal('historyModal');
  }
  function renderHistoryList() {
    if (!historyCtx) return;
    const list = state.history[histKey(historyCtx.pageId, historyCtx.secId)] || [];
    const wrap = document.getElementById('hsList');
    wrap.innerHTML = '';
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-history">이 섹션의 수정 이력이 아직 없습니다.<br/>섹션을 편집·저장하면 이전 버전이 여기에 쌓입니다.</div>';
      return;
    }
    list.forEach((v, idx) => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.style.flexDirection = 'column';
      row.style.alignItems = 'stretch';
      const previewText = (v.html || '').replace(/\s+/g, ' ').slice(0, 120);
      const kindLabel =
        v.kind === 'wip'          ? '⚙ 작업중' :
        v.kind === 'request'      ? '✋ 컨펌요청' :
        v.kind === 'approve'      ? '✅ 승인' :
        v.kind === 'revision'     ? '↻ 재수정요청' :
        v.kind === 'reset-status' ? '⊘ 초안화' :
        v.kind === 'confirm'      ? '✓ 컨펌(legacy)' :
        v.kind === 'unconfirm'    ? '↺ 컨펌해제(legacy)' :
        v.kind === 'restore'      ? '⟲ 복원' : '✎ 편집';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="when" style="flex:1;">
            v${list.length - idx} · ${fmtDate(v.savedAt)} · <b>${escapeHtml(v.name || '(이름 없음)')}</b>
            <span style="font-size:10px; padding:2px 7px; border-radius:999px; background:var(--light); color:var(--ink2); margin-left:6px;">${kindLabel}</span>
            <span class="preview-text">${escapeHtml(previewText) || '(빈 HTML)'}</span>
          </div>
          <div class="actions">
            <button class="btn btn-sm btn-outline" data-act="copy" title="HTML 코드 복사">HTML 복사</button>
            <button class="btn btn-sm btn-ghost" data-act="view">미리보기</button>
            <button class="btn btn-sm btn-primary" data-act="restore">복원</button>
            <button class="btn btn-sm btn-danger" data-act="del" title="이 버전을 영구 삭제 (복구 불가)">🗑 영구 삭제</button>
          </div>
        </div>
        <div class="reason-row">
          <span class="reason-label">변경 사유</span>
          <div class="reason-text ${v.reason ? '' : 'empty'}" data-act="edit-reason" title="클릭하여 수정">${v.reason ? escapeHtml(v.reason) : '(사유 없음 — 클릭하여 추가)'}</div>
        </div>
        <div class="del-confirm" data-del-confirm style="display:none;"></div>
      `;
      row.querySelector('[data-act=copy]').addEventListener('click', () => copyHtmlToClipboard(v.html));
      row.querySelector('[data-act=view]').addEventListener('click', () => previewHtml(v.html, v.name));
      row.querySelector('[data-act=restore]').addEventListener('click', () => restoreVersion(idx));
      row.querySelector('[data-act=edit-reason]').addEventListener('click', () => startEditReason(row, idx));
      row.querySelector('[data-act=del]').addEventListener('click', () => startDeleteHistoryConfirm(row, idx));
      wrap.appendChild(row);
    });
  }
  // 이력 항목 영구 삭제 — 인라인 2단계 확인 ("영구 삭제" 수기 입력 + 확인 버튼)
  function startDeleteHistoryConfirm(row, idx) {
    if (!historyCtx) return;
    const list = state.history[histKey(historyCtx.pageId, historyCtx.secId)] || [];
    const v = list[idx];
    if (!v) return;
    const verNum = list.length - idx;
    const box = row.querySelector('[data-del-confirm]');
    if (!box) return;
    // 이미 열려있으면 닫기 토글
    if (box.style.display !== 'none') { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = `
      <div class="del-warn">
        <span class="del-warn-icon">⚠</span>
        <div class="del-warn-text">
          <b>v${verNum} 버전을 영구 삭제합니다.</b><br/>
          이 작업은 <b>되돌릴 수 없습니다.</b> 진행하려면 아래 칸에 <b>영구 삭제</b>를 정확히 입력하고 확인 버튼을 누르세요.
        </div>
      </div>
      <div class="del-confirm-row">
        <input type="text" class="del-confirm-input" placeholder='여기에 "영구 삭제" 입력' autocomplete="off" />
        <button class="btn btn-sm btn-danger" data-confirm disabled>영구 삭제하기</button>
        <button class="btn btn-sm btn-ghost" data-cancel>취소</button>
      </div>
    `;
    const input = box.querySelector('.del-confirm-input');
    const confirmBtn = box.querySelector('[data-confirm]');
    const cancelBtn = box.querySelector('[data-cancel]');
    const REQUIRED = '영구 삭제';
    input.addEventListener('input', () => {
      confirmBtn.disabled = input.value.trim() !== REQUIRED;
    });
    input.focus();
    cancelBtn.addEventListener('click', () => { box.style.display = 'none'; box.innerHTML = ''; });
    confirmBtn.addEventListener('click', () => {
      if (input.value.trim() !== REQUIRED) return;
      deleteHistoryEntry(idx);
    });
  }
  function deleteHistoryEntry(idx) {
    if (!historyCtx) return;
    const key = histKey(historyCtx.pageId, historyCtx.secId);
    const list = state.history[key] || [];
    const v = list[idx];
    if (!v) return;
    list.splice(idx, 1);
    if (list.length === 0) delete state.history[key];
    saveState();
    renderHistoryList();
    toast('영구 삭제 완료', 'info');
  }
  function startEditReason(row, idx) {
    if (!historyCtx) return;
    const list = state.history[histKey(historyCtx.pageId, historyCtx.secId)] || [];
    const v = list[idx];
    if (!v) return;
    const cell = row.querySelector('.reason-row');
    cell.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'reason-label';
    label.textContent = '변경 사유';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'reason-edit';
    input.value = v.reason || '';
    input.placeholder = '예: 컨펌 후 수정 / 카피 변경';
    const ok = document.createElement('button');
    ok.className = 'btn btn-sm btn-primary';
    ok.textContent = '저장';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-sm btn-ghost';
    cancel.textContent = '취소';
    cell.appendChild(label); cell.appendChild(input); cell.appendChild(ok); cell.appendChild(cancel);
    input.focus(); input.select();
    const commit = () => {
      v.reason = input.value.trim();
      saveState();
      renderHistoryList();
      toast('변경 사유 수정됨', 'success');
    };
    ok.addEventListener('click', commit);
    cancel.addEventListener('click', renderHistoryList);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit();
      else if (e.key === 'Escape') renderHistoryList();
    });
  }
  function restoreVersion(idx) {
    if (!historyCtx) return;
    const list = state.history[histKey(historyCtx.pageId, historyCtx.secId)] || [];
    const v = list[idx];
    if (!v) return;
    const sec = getSection(historyCtx.pageId, historyCtx.secId);
    if (!sec) return;
    const verNum = list.length - idx;
    if (!confirm(`v${verNum} 버전으로 복원할까요? 현재 내용은 새 이력으로 보관됩니다.`)) return;
    pushHistory(historyCtx.pageId, historyCtx.secId, {
      name: sec.name, html: sec.html, note: sec.note,
      reason: `v${verNum}로 복원하기 직전 상태`,
      kind: 'restore', savedAt: nowIso(),
    });
    sec.name = v.name || sec.name;
    sec.html = v.html || '';
    sec.note = v.note || sec.note;
    saveState();
    closeModal('historyModal');
    renderSections();
    toast(`v${verNum}로 복원됨`, 'success');
  }

  // -------- preview --------
  function previewBaseHref() {
    // 미리보기 문서 안의 상대 경로(예: ./pour-store-cafe24.html)가
    // 부모 페이지(/pourstore-renewal/preview.html) 기준으로 해석되도록
    // <base href>를 부모 디렉터리 URL로 고정한다.
    const href = window.location.href.replace(/[^/]*$/, '');
    return href;
  }
  // Pretendard CDN — 오늘의집과 동일 폰트 (variable + static fallback)
  const PRETENDARD_CSS_URL = 'https://cdn.jsdelivr.net/gh/orioncactus/[email protected]/dist/web/variable/pretendardvariable.css';
  function buildFontTokensCss() {
    const tokens = (state && Array.isArray(state.fontTokens)) ? state.fontTokens : [];
    if (tokens.length === 0) return '';
    const rules = tokens.map(t => {
      const key = sanitizeRoleKey(t.key);
      if (!key) return '';
      const decl = [
        t.fontFamily   && `font-family:${t.fontFamily}`,
        t.fontSize     && `font-size:${t.fontSize}`,
        t.fontWeight   && `font-weight:${t.fontWeight}`,
        t.color        && `color:${t.color}`,
        t.lineHeight   && `line-height:${t.lineHeight}`,
        t.letterSpacing && `letter-spacing:${t.letterSpacing}`,
      ].filter(Boolean).join(';');
      return `.role-${key}{${decl};}`;
    }).filter(Boolean).join('\n');
    if (!rules) return '';
    // @import을 인라인 <style>에 포함 — 외부 사이트(카페24 등)에 붙여넣어도 Pretendard가 자동 로드됨
    return `<style data-pour-font-tokens="1">\n@import url('${PRETENDARD_CSS_URL}');\n${rules}\n</style>`;
  }
  function wrapPreview(bodyHtml) {
    const baseHref = previewBaseHref();
    return [
      '<!doctype html><html lang="ko"><head><meta charset="UTF-8"/>',
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
      `<base href="${baseHref}"/>`,
      '<title>섹션 미리보기</title>',
      `<link href="${PRETENDARD_CSS_URL}" rel="stylesheet"/>`,
      '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Bebas+Neue&display=swap" rel="stylesheet"/>',
      '<style>html,body{margin:0;font-family:\'Pretendard Variable\',Pretendard,-apple-system,BlinkMacSystemFont,\'Apple SD Gothic Neo\',\'Noto Sans KR\',sans-serif;background:#fff;color:#111827;}</style>',
      buildFontTokensCss(),
      '</head><body>',
      bodyHtml || '<div style="padding:40px; text-align:center; color:#9CA3AF; font-size:13px;">섹션 HTML이 비어있습니다.</div>',
      '</body></html>'
    ].join('');
  }
  function previewSection(secId) {
    const page = getActivePage();
    const sec = getSection(page.id, secId);
    if (!sec) return;
    previewHtml(sec.html, `${page.name} · ${sec.name}`);
  }
  function copyTextToClipboard(text, successMsg) {
    if (!text) return;
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        toast(ok ? (successMsg || '복사됨') : '복사 실패', ok ? 'success' : 'error');
      } catch (e) { toast('복사 실패: ' + e.message, 'error'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast(successMsg || '복사됨', 'success'))
        .catch(fallback);
    } else { fallback(); }
  }
  function copySectionLink(pageId, secId) {
    const url = location.origin + location.pathname + '#share=' + encodeURIComponent(pageId) + ':' + encodeURIComponent(secId);
    copyTextToClipboard(url, '🔗 섹션 공유 링크가 복사됐어요 — 받는 분이 열면 이 섹션만 보입니다');
  }
  function copyPageLink(pageId) {
    const url = location.origin + location.pathname + '#sharepage=' + encodeURIComponent(pageId);
    copyTextToClipboard(url, '🔗 페이지 공유 링크가 복사됐어요');
  }
  function checkShareLinkMode() {
    var sm = location.hash.match(/^#share=([^:&]+):([^:&]+)/);
    if (sm) {
      var sec = getSection(decodeURIComponent(sm[1]), decodeURIComponent(sm[2]));
      if (!sec) return false;
      writeShareDoc(sec.html || '', sec.name);
      return true;
    }
    var pm = location.hash.match(/^#sharepage=([^&]+)/);
    if (pm) {
      var pid = decodeURIComponent(pm[1]);
      var page = state.pages.find(function(p){ return p.id === pid; });
      if (!page) return false;
      var body = page.sections.filter(function(s){ return !s.hidden; }).map(function(s, i){
        var html = (s.html || '').trim();
        if (!html) return '<!-- [' + (i+1) + '] ' + s.name + ' (EMPTY) -->';
        return '<!-- [' + (i+1) + '] ' + s.name + ' -->\n<section data-section="' + escapeHtml(s.name) + '">\n' + s.html + '\n</section>';
      }).join('\n\n');
      writeShareDoc(body, page.name);
      return true;
    }
    return false;
  }
  function writeShareDoc(html, title) {
    document.open();
    document.write(wrapPreview(html));
    document.close();
    if (title) try { document.title = title + ' · POUR스토어'; } catch (_) {}
  }

  function copyHtmlToClipboard(html) {
    const text = html || '';
    if (!text) { toast('복사할 HTML이 비어있습니다.', 'info'); return; }
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        toast(ok ? `HTML 복사됨 (${text.length.toLocaleString()}자)` : '복사 실패', ok ? 'success' : 'error');
      } catch (e) {
        toast('복사 실패: ' + e.message, 'error');
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast(`HTML 복사됨 (${text.length.toLocaleString()}자)`, 'success'))
        .catch(fallback);
    } else {
      fallback();
    }
  }

  function previewHtml(html, title) {
    const w = window.open('', '_blank');
    if (!w) { toast('팝업이 차단되었습니다.', 'error'); return; }
    w.document.open();
    w.document.write(wrapPreview(html));
    w.document.close();
    if (title) try { w.document.title = title; } catch (_) {}
  }
  function buildFullPageHtml(page) {
    const body = page.sections.filter(s => !s.hidden).map((s, i) => {
      const html = (s.html || '').trim();
      if (!html) return `<!-- [${i+1}] ${s.name} (EMPTY) -->`;
      return `<!-- [${i+1}] ${s.name} -->\n<section data-section="${escapeHtml(s.name)}">\n${s.html}\n</section>`;
    }).join('\n\n');
    const fontCss = buildFontTokensCss();
    return fontCss
      ? `<!-- [폰트 토큰] 폰트 관리에서 역할별로 일괄 정의됨 -->\n${fontCss}\n\n${body}`
      : body;
  }

  // 미리보기 모달용 — 각 섹션을 id로 감싸서 스크롤·하이라이트 지원
  function buildFullPagePreviewHtml(page) {
    return page.sections.filter(s => !s.hidden).map((s, i) => {
      const html = (s.html || '').trim();
      const idAttr = `fpv-sec-${escapeHtml(s.id)}`;
      if (!html) {
        return [
          `<!-- [${i+1}] ${s.name} (EMPTY) -->`,
          `<section id="${idAttr}" data-fpv-secid="${escapeHtml(s.id)}" data-empty="1" style="padding:60px 30px; text-align:center; color:#9CA3AF; font-size:13px; background:#FAFAFA; border-bottom:1px dashed #E5E7EB;">`,
          `(빈 섹션 — ${escapeHtml(s.name)})`,
          '</section>'
        ].join('\n');
      }
      return [
        `<!-- [${i+1}] ${s.name} -->`,
        `<section id="${idAttr}" data-fpv-secid="${escapeHtml(s.id)}" data-section="${escapeHtml(s.name)}">`,
        s.html,
        '</section>'
      ].join('\n');
    }).join('\n\n');
  }

  function previewFullPageInWindow() {
    const page = getActivePage();
    const body = buildFullPageHtml(page);
    const w = window.open('', '_blank');
    if (!w) { toast('팝업이 차단되었습니다.', 'error'); return; }
    w.document.open();
    w.document.write(wrapPreview(body));
    w.document.close();
    try { w.document.title = `${page.name} 시안`; } catch (_) {}
  }

  // -------- 전체 시안 모달 (좌: 섹션·이전시안 · 중: iframe · 우: 댓글) --------
  let fpvCtx = null; // { pageId, secId } — secId: 우측 댓글 패널이 가리키는 섹션
  function previewFullPage() {
    const page = getActivePage();
    if (!page) return;
    if (page.type === 'folder') { toast('폴더에는 섹션이 없습니다.', 'info'); return; }
    const firstVisible = page.sections.find(x => !x.hidden) || page.sections[0];
    fpvCtx = { pageId: page.id, secId: (firstVisible && firstVisible.id) || null };
    document.getElementById('fpvTitle').textContent = `전체 시안 — ${page.name}`;
    renderFpvSectionList();
    refreshFpvAuthorChip();
    renderFpvComments();
    openModal('fullPreviewModal');
    // iframe 로드 후 첫 섹션으로 스크롤
    const frame = document.getElementById('fpvFrame');
    frame.onload = () => {
      if (fpvCtx && fpvCtx.secId) scrollFpvFrameTo(fpvCtx.secId);
      frame.onload = null;
    };
    frame.srcdoc = wrapPreview(buildFullPagePreviewHtml(page));
  }
  function getFpvPage() {
    if (!fpvCtx) return null;
    return state.pages.find(p => p.id === fpvCtx.pageId) || null;
  }
  function getFpvSection() {
    const page = getFpvPage();
    if (!page || !fpvCtx.secId) return null;
    return page.sections.find(s => s.id === fpvCtx.secId) || null;
  }
  function renderFpvSectionList() {
    const wrap = document.getElementById('fpvSectionList');
    if (!wrap) return;
    const page = getFpvPage();
    wrap.innerHTML = '';
    if (!page || page.sections.length === 0) {
      wrap.innerHTML = '<div class="fpv-empty-state">이 페이지에는 섹션이 없습니다.</div>';
      return;
    }
    page.sections.forEach((s, idx) => {
      const histLen = (state.history[histKey(page.id, s.id)] || []).length;
      const cmtCount = (s.feedbacks || []).length;
      const isActive = fpvCtx.secId === s.id;
      const isEmpty = !((s.html || '').trim());
      const row = document.createElement('div');
      row.className = 'fpv-section-item' + (isActive ? ' active' : '') + (s.hidden ? ' fpv-hidden' : '');
      row.dataset.secid = s.id;
      row.innerHTML = `
        <span class="fpv-idx">${idx + 1}</span>
        <span class="fpv-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
        ${s.hidden ? '<span class="fpv-empty-tag" style="background:#6B7280;color:#fff;">🙈 숨김</span>' : ''}
        ${isEmpty ? '<span class="fpv-empty-tag">빈 섹션</span>' : ''}
        <span class="fpv-cmt-badge ${cmtCount === 0 ? 'zero' : ''}" title="댓글 ${cmtCount}건">${cmtCount}</span>
        <button class="fpv-prev-btn" data-act="prev" ${histLen === 0 ? 'disabled' : ''} title="${histLen === 0 ? '이전 시안 없음' : `이전 시안 ${histLen}건 보기`}">↺ 이전 시안</button>
      `;
      row.addEventListener('click', e => {
        if (e.target.closest('[data-act=prev]')) return;
        selectFpvSection(s.id, true);
      });
      const prevBtn = row.querySelector('[data-act=prev]');
      if (prevBtn && histLen > 0) {
        prevBtn.addEventListener('click', e => {
          e.stopPropagation();
          openFpvHistory(s.id);
        });
      }
      wrap.appendChild(row);
    });
  }
  function selectFpvSection(secId, scroll) {
    if (!fpvCtx) return;
    fpvCtx.secId = secId;
    renderFpvSectionList();
    renderFpvComments();
    if (scroll) scrollFpvFrameTo(secId);
  }
  function scrollFpvFrameTo(secId) {
    const frame = document.getElementById('fpvFrame');
    if (!frame) return;
    let doc = null;
    try { doc = frame.contentDocument; } catch (_) {}
    if (!doc) return;
    const el = doc.getElementById('fpv-sec-' + secId);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  // 이전 시안 — 기존 historyModal 재사용
  function openFpvHistory(secId) {
    if (!fpvCtx) return;
    const page = getFpvPage();
    const sec = page && page.sections.find(s => s.id === secId);
    if (!sec) return;
    historyCtx = { pageId: page.id, secId };
    document.getElementById('hsTitle').textContent = `이전 시안 — ${sec.name}`;
    renderHistoryList();
    openModal('historyModal');
  }
  function refreshFpvAuthorChip() {
    const chip = document.getElementById('fpvAuthorChip');
    if (!chip) return;
    const me = getMeStaff();
    if (me) {
      chip.innerHTML = `작성자: <b style="color:${escapeHtml(staffColor(me))};">${escapeHtml(me.name)}</b>${me.role ? ' · ' + escapeHtml(me.role) : ''}`;
    } else {
      chip.innerHTML = '작성자 없음 (익명) — <a href="#" id="fpvSetMeLink">내 이름 설정</a>';
      const link = chip.querySelector('#fpvSetMeLink');
      if (link) link.addEventListener('click', e => { e.preventDefault(); openMeModal(); });
    }
  }
  function renderFpvComments() {
    const targetEl = document.getElementById('fpvCommentTarget');
    const countEl = document.getElementById('fpvCommentCount');
    const listEl = document.getElementById('fpvCommentList');
    const inputEl = document.getElementById('fpvCommentInput');
    const addBtn = document.getElementById('fpvCommentAdd');
    if (!listEl) return;
    const sec = getFpvSection();
    if (!sec) {
      if (targetEl) targetEl.textContent = '섹션을 선택하세요';
      if (countEl) { countEl.textContent = '0'; countEl.classList.add('zero'); }
      listEl.innerHTML = '<div class="fpv-empty-state">왼쪽에서 섹션을 선택하면 댓글이 표시됩니다.</div>';
      if (inputEl) { inputEl.disabled = true; inputEl.value = ''; }
      if (addBtn) addBtn.disabled = true;
      return;
    }
    if (targetEl) targetEl.textContent = sec.name;
    const list = (sec.feedbacks || []);
    if (countEl) {
      countEl.textContent = String(list.length);
      countEl.classList.toggle('zero', list.length === 0);
    }
    if (inputEl) inputEl.disabled = false;
    if (addBtn) addBtn.disabled = false;
    listEl.innerHTML = '';
    if (list.length === 0) {
      listEl.innerHTML = '<div class="fpv-empty-state">아직 등록된 댓글이 없습니다.<br/>위 입력란에 의견을 적어 주세요.</div>';
      return;
    }
    const me = getMeStaff();
    list.forEach(fb => {
      const row = document.createElement('div');
      row.className = 'fb-item';
      const canDelete = !fb.staffId || (me && me.id === fb.staffId);
      row.innerHTML = `
        <div class="fb-head">
          <span class="staff-avatar sm" style="background:${escapeHtml(staffColor(findStaffById(fb.staffId) || { color: '#6B7280' }))}">${escapeHtml(staffInitial(fb.staffName))}</span>
          <span class="fb-author"><b>${escapeHtml(fb.staffName || '익명')}</b>${fb.staffRole ? ' · ' + escapeHtml(fb.staffRole) : ''}</span>
          <span class="fb-when">${escapeHtml(fmtDate(fb.createdAt))}</span>
          ${canDelete ? '<button class="fb-del" title="삭제" data-act="del">×</button>' : ''}
        </div>
        <div class="fb-text">${escapeHtml(fb.text)}</div>
      `;
      const del = row.querySelector('[data-act=del]');
      if (del) del.addEventListener('click', () => {
        const target = { type: 'section', pageId: fpvCtx.pageId, secId: fpvCtx.secId };
        if (deleteFeedback(target, fb.id)) {
          renderFpvComments();
          renderFpvSectionList();
          renderSections();
          updatePageFeedbackCount();
          toast('삭제됨', 'info');
        }
      });
      listEl.appendChild(row);
    });
  }
  function submitFpvComment() {
    if (!fpvCtx || !fpvCtx.secId) return;
    const input = document.getElementById('fpvCommentInput');
    if (!input) return;
    const target = { type: 'section', pageId: fpvCtx.pageId, secId: fpvCtx.secId };
    if (addFeedback(target, input.value)) {
      input.value = '';
      renderFpvComments();
      renderFpvSectionList();
      renderSections();
      updatePageFeedbackCount();
      toast('댓글 등록됨', 'success');
    }
  }

  function copyFullPageHtml() {
    const page = getActivePage();
    const filled = page.sections.filter(s => !s.hidden && (s.html || '').trim());
    if (filled.length === 0) {
      toast('이 페이지에 표시할 섹션 HTML이 없습니다. (숨김 제외)', 'error');
      return;
    }
    const html = buildFullPageHtml(page);
    copyHtmlToClipboard(html);
  }

  // -------- 폰트 토큰 (역할별 일괄 폰트) --------
  function openFontTokensModal() {
    renderFontTokensList();
    renderFontConfirmBar();
    renderFontHistory();
    const memoEl = document.getElementById('ftMemo');
    if (memoEl) memoEl.value = (state.fontSystem && state.fontSystem.note) || '';
    openModal('fontTokensModal');
  }
  // 폰트 시스템 — 컨펌 상태 바 렌더
  function renderFontConfirmBar() {
    const fs = state.fontSystem || {};
    const chip = document.getElementById('ftStatusBtn');
    const icon = document.getElementById('ftStatusIcon');
    const text = document.getElementById('ftStatusText');
    const meta = document.getElementById('ftStatusMeta');
    if (!chip) return;
    const meta1 = STATUS_META[fs.status];
    if (meta1) {
      chip.setAttribute('data-status', fs.status);
      icon.textContent = meta1.icon;
      text.textContent = meta1.label;
    } else {
      chip.removeAttribute('data-status');
      icon.textContent = '●';
      text.textContent = '초안';
    }
    if (meta) {
      if (fs.statusAt) {
        const who = fs.statusByName ? ` · ${fs.statusByName}` : '';
        meta.textContent = `${fmtDate(fs.statusAt)}${who}`;
      } else {
        meta.textContent = '';
      }
    }
    // 이력 배지
    const histBadge = document.getElementById('ftHistoryCount');
    if (histBadge) {
      const cnt = (fs.history || []).length;
      histBadge.textContent = String(cnt);
      histBadge.classList.toggle('has', cnt > 0);
    }
  }
  function toggleFontStatusMenu(force) {
    const menu = document.getElementById('ftStatusMenu');
    if (!menu) return;
    const open = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', open);
  }
  function setFontSystemStatus(newStatus) {
    const fs = state.fontSystem || (state.fontSystem = { status: null, statusAt: null, statusBy: null, statusByName: null, note: '', history: [] });
    newStatus = newStatus || null;
    if ((fs.status || null) === newStatus) { toggleFontStatusMenu(false); return; }
    const fromLabel = STATUS_META[fs.status] ? STATUS_META[fs.status].label : '초안';
    const toLabel = STATUS_META[newStatus] ? STATUS_META[newStatus].label : '초안';
    // 변경 사유 입력 (사용자 확인)
    const reasonInput = prompt(`폰트 시스템 상태 변경\n\n${fromLabel} → ${toLabel}\n\n변경 사유를 입력하세요 (이력에 기록됨):`, '');
    if (reasonInput === null) { toggleFontStatusMenu(false); return; } // 취소
    const reason = reasonInput.trim();
    const me = getMeStaff ? getMeStaff() : null;
    let kind, toastMsg, toastType;
    if (newStatus === 'wip')           { kind = 'wip';      toastMsg = '작업중으로 표시됨';   toastType = 'info'; }
    else if (newStatus === 'requested'){ kind = 'request';  toastMsg = '컨펌 요청으로 표시됨'; toastType = 'info'; }
    else if (newStatus === 'approved') { kind = 'approve';  toastMsg = '승인 완료로 표시됨';   toastType = 'success'; }
    else if (newStatus === 'revision') { kind = 'revision'; toastMsg = '재수정 요청으로 표시됨'; toastType = 'error'; }
    else                                { kind = 'reset-status'; toastMsg = '초안 상태로 되돌림'; toastType = 'info'; }
    fs.history = fs.history || [];
    fs.history.unshift({
      kind,
      reason: reason || `${fromLabel} → ${toLabel}`,
      status: newStatus,
      fromStatus: fs.status || null,
      note: fs.note || '',
      staffId: me ? me.id : null,
      staffName: me ? me.name : null,
      staffRole: me ? me.role : null,
      savedAt: nowIso(),
    });
    fs.status = newStatus;
    fs.statusAt = newStatus ? nowIso() : null;
    fs.statusBy = me ? me.id : null;
    fs.statusByName = me ? me.name : null;
    saveState();
    toggleFontStatusMenu(false);
    renderFontConfirmBar();
    renderFontHistory();
    toast(`폰트 시스템 → ${toLabel} · ${toastMsg}`, toastType);
  }
  function updateFontSystemNote(value) {
    const fs = state.fontSystem || (state.fontSystem = { status: null, statusAt: null, statusBy: null, statusByName: null, note: '', history: [] });
    fs.note = String(value || '');
    saveState();
  }
  function renderFontHistory() {
    const list = document.getElementById('ftHistoryList');
    if (!list) return;
    const fs = state.fontSystem || {};
    const arr = fs.history || [];
    list.innerHTML = '';
    if (arr.length === 0) {
      list.innerHTML = '<div class="ft-history-empty">아직 변경 이력이 없습니다.<br/>상단 상태 칩을 클릭해 컨펌 요청·승인·재수정 흐름을 시작하세요.</div>';
      return;
    }
    arr.forEach(h => {
      const row = document.createElement('div');
      row.className = 'ft-history-item';
      const kindLabel =
        h.kind === 'approve'      ? '✅ 승인' :
        h.kind === 'request'      ? '✋ 컨펌요청' :
        h.kind === 'revision'     ? '↻ 재수정요청' :
        h.kind === 'wip'          ? '⚙ 작업중' :
        h.kind === 'reset-status' ? '⊘ 초안화' : '✎ 변경';
      row.innerHTML = `
        <div class="fh-head">
          <span class="fh-kind" data-k="${escapeHtml(h.kind || '')}">${kindLabel}</span>
          ${h.staffName ? `<span class="fh-who">${escapeHtml(h.staffName)}${h.staffRole ? ' · ' + escapeHtml(h.staffRole) : ''}</span>` : '<span class="fh-who" style="color:var(--muted); font-weight:500;">익명</span>'}
          <span class="fh-when">${escapeHtml(fmtDate(h.savedAt))}</span>
        </div>
        ${h.reason ? `<div class="fh-reason">${escapeHtml(h.reason)}</div>` : ''}
        ${h.note ? `<div class="fh-reason" style="background:var(--light); padding:6px 8px; border-radius:6px; color:var(--ink2); font-size:11.5px;">📝 ${escapeHtml(h.note)}</div>` : ''}
      `;
      list.appendChild(row);
    });
  }


  function renderFontTokensList() {
    const wrap = document.getElementById('ftList');
    if (!wrap) return;
    wrap.innerHTML = '';
    const tokens = state.fontTokens || [];
    if (tokens.length === 0) {
      wrap.innerHTML = '<div class="ft-empty">등록된 역할이 없습니다.<br/>아래 <b>+ 역할 추가</b>를 눌러 첫 역할을 만들어 주세요.</div>';
      return;
    }
    tokens.forEach(t => {
      const row = document.createElement('div');
      row.className = 'ft-item';
      row.dataset.id = t.id;
      row.innerHTML = `
        <div class="ft-field"><label>키 (class명)</label><input class="ft-key" data-f="key" value="${escapeHtml(t.key)}" placeholder="예: 강조" maxlength="24" /></div>
        <div class="ft-field"><label>설명 (이름표)</label><input data-f="label" value="${escapeHtml(t.label)}" placeholder="예: 강조 (emphasis)" maxlength="40" /></div>
        <div class="ft-field"><label>폰트 패밀리</label><input data-f="fontFamily" value="${escapeHtml(t.fontFamily)}" placeholder="'Noto Sans KR', sans-serif" /></div>
        <div class="ft-field"><label>크기</label><input data-f="fontSize" value="${escapeHtml(t.fontSize)}" placeholder="16px" /></div>
        <div class="ft-field"><label>굵기</label><input data-f="fontWeight" value="${escapeHtml(t.fontWeight)}" placeholder="400~900" /></div>
        <div class="ft-field"><label>줄 높이</label><input data-f="lineHeight" value="${escapeHtml(t.lineHeight)}" placeholder="1.6" /></div>
        <div class="ft-field"><label>색상</label><input type="color" data-f="color" value="${escapeHtml(toHexColor(t.color))}" /></div>
        <button class="ft-del" data-act="del" title="이 역할 삭제">삭제</button>
        <div class="ft-field" style="grid-column:1/-1;"><label>자간 (letter-spacing)</label><input data-f="letterSpacing" value="${escapeHtml(t.letterSpacing)}" placeholder="0 / -0.02em" /></div>
        <div class="ft-preview" data-preview style="font-family:${cssEscape(t.fontFamily)}; font-size:${cssEscape(t.fontSize)}; font-weight:${cssEscape(t.fontWeight)}; color:${cssEscape(t.color)}; line-height:${cssEscape(t.lineHeight)}; letter-spacing:${cssEscape(t.letterSpacing)};">미리보기 — 가나다라 ABC 0123 ${escapeHtml(t.label || t.key)}</div>
      `;
      row.querySelectorAll('input[data-f]').forEach(inp => {
        inp.addEventListener('input', () => updateFontToken(t.id, inp.dataset.f, inp.value));
        inp.addEventListener('blur', () => {
          if (inp.dataset.f === 'key') {
            const cleaned = sanitizeRoleKey(inp.value);
            if (cleaned !== inp.value) { inp.value = cleaned; updateFontToken(t.id, 'key', cleaned); }
          }
        });
      });
      row.querySelector('[data-act=del]').addEventListener('click', () => deleteFontToken(t.id));
      wrap.appendChild(row);
    });
  }
  function toHexColor(v) {
    // <input type=color>는 #rrggbb만 허용 — rgb/이름을 임시로 #111827로 폴백
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim())) return v.trim();
    return '#111827';
  }
  function cssEscape(v) {
    // 인라인 style 속성에 들어가는 값 — 쌍따옴표만 안전화
    return String(v == null ? '' : v).replace(/"/g, "'");
  }
  function updateFontToken(id, field, value) {
    const t = (state.fontTokens || []).find(x => x.id === id);
    if (!t) return;
    if (field === 'key') value = sanitizeRoleKey(value);
    t[field] = String(value);
    // 즉시 미리보기 갱신
    const row = document.querySelector(`.ft-item[data-id="${id}"]`);
    if (row) {
      const pv = row.querySelector('[data-preview]');
      if (pv) {
        pv.style.fontFamily = t.fontFamily;
        pv.style.fontSize = t.fontSize;
        pv.style.fontWeight = t.fontWeight;
        pv.style.color = t.color;
        pv.style.lineHeight = t.lineHeight;
        pv.style.letterSpacing = t.letterSpacing;
        if (field === 'label' || field === 'key') {
          pv.textContent = `미리보기 — 가나다라 ABC 0123 ${t.label || t.key}`;
        }
      }
    }
    saveState();
    // 열려있는 섹션 편집 미리보기에도 즉시 반영
    if (document.getElementById('editorModal').classList.contains('open')) {
      refreshEditorPreview();
    }
  }
  function addFontToken() {
    const id = 'ft-' + Math.random().toString(36).slice(2, 8);
    (state.fontTokens = state.fontTokens || []).push({
      id, key: '역할' + (state.fontTokens.length + 1), label: '새 역할',
      fontFamily: "'Noto Sans KR', sans-serif", fontSize: '15px', fontWeight: '400',
      color: '#111827', lineHeight: '1.6', letterSpacing: '0',
    });
    saveState();
    renderFontTokensList();
    renderEditorRoleBar();
    toast('역할 추가됨', 'success');
  }
  function deleteFontToken(id) {
    const t = (state.fontTokens || []).find(x => x.id === id);
    if (!t) return;
    if (!confirm(`"${t.label || t.key}" 역할을 삭제할까요?\n섹션 HTML에 박혀있는 class="role-${t.key}"는 그대로 남지만 폰트가 더이상 적용되지 않습니다.`)) return;
    state.fontTokens = state.fontTokens.filter(x => x.id !== id);
    saveState();
    renderFontTokensList();
    renderEditorRoleBar();
    if (document.getElementById('editorModal').classList.contains('open')) refreshEditorPreview();
    toast('삭제됨', 'info');
  }
  function resetFontTokens() {
    if (!confirm('폰트 역할을 기본값(제목·강조·서브·본문)으로 되돌릴까요?\n현재 등록된 역할은 모두 사라집니다.')) return;
    state.fontTokens = DEFAULT_FONT_TOKENS();
    saveState();
    renderFontTokensList();
    renderEditorRoleBar();
    if (document.getElementById('editorModal').classList.contains('open')) refreshEditorPreview();
    toast('기본값으로 초기화', 'success');
  }
  // 편집 모달 — 텍스트 선택 영역을 <span class="role-…">로 감싸기
  function renderEditorRoleBar() {
    const bar = document.getElementById('edRoleBar');
    if (!bar) return;
    bar.innerHTML = '';
    const tokens = state.fontTokens || [];
    if (tokens.length === 0) {
      bar.innerHTML = '<span class="ed-role-hint">폰트 관리에서 역할을 먼저 등록하세요.</span>';
      return;
    }
    const hint = document.createElement('span');
    hint.className = 'ed-role-hint';
    hint.textContent = '역할 적용:';
    bar.appendChild(hint);
    tokens.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ed-role-chip';
      btn.textContent = t.label || t.key;
      btn.style.color = t.color || '';
      btn.title = `선택한 텍스트를 <span class="role-${t.key}">로 감쌉니다`;
      btn.addEventListener('click', e => { e.preventDefault(); wrapSelectionWithRole(t.key); });
      bar.appendChild(btn);
    });
    const mgr = document.createElement('button');
    mgr.type = 'button';
    mgr.className = 'ed-role-chip';
    mgr.textContent = '⚙ 관리';
    mgr.title = '폰트 관리 열기';
    mgr.style.marginLeft = 'auto';
    mgr.addEventListener('click', e => { e.preventDefault(); openFontTokensModal(); });
    bar.appendChild(mgr);
  }
  function wrapSelectionWithRole(rawKey) {
    const ta = document.getElementById('edHtml');
    if (!ta) return;
    const key = sanitizeRoleKey(rawKey);
    if (!key) { toast('역할 키가 비어있습니다.', 'error'); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end) { toast('적용할 텍스트를 먼저 선택해 주세요.', 'info'); return; }
    const before = ta.value.slice(0, start);
    const sel = ta.value.slice(start, end);
    const after = ta.value.slice(end);
    const open = `<span class="role-${key}">`;
    const close = '</span>';
    ta.value = before + open + sel + close + after;
    const newPos = start + open.length + sel.length + close.length;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();
    refreshEditorPreview();
  }

  // -------- staff + me (담당자) --------
  function getMeStaffId() {
    try { return localStorage.getItem(ME_STAFF_KEY) || null; } catch (_) { return null; }
  }
  function setMeStaffId(id) {
    try {
      if (id) localStorage.setItem(ME_STAFF_KEY, id);
      else localStorage.removeItem(ME_STAFF_KEY);
    } catch (_) {}
    renderMeCard();
    renderMeStaffOptions();
    refreshFeedbackAuthorChip();
    if (typeof refreshFpvAuthorChip === 'function') refreshFpvAuthorChip();
  }
  function getMeStaff() {
    const id = getMeStaffId();
    if (!id) return null;
    return (state.staff || []).find(s => s.id === id) || null;
  }
  function staffColor(staff, fallbackIdx) {
    if (staff && staff.color) return staff.color;
    return STAFF_COLORS[(fallbackIdx || 0) % STAFF_COLORS.length];
  }
  function staffInitial(name) {
    if (!name) return '?';
    return name.trim().slice(0, 1).toUpperCase();
  }
  function findStaffById(id) { return (state.staff || []).find(s => s.id === id) || null; }
  function addStaff(name, role) {
    name = (name || '').trim(); role = (role || '').trim();
    if (!name) { toast('이름을 입력하세요.', 'error'); return false; }
    const exists = (state.staff || []).some(s => s.name === name && s.role === role);
    if (exists) { toast('이미 같은 이름·직함이 등록돼 있습니다.', 'error'); return false; }
    const idx = (state.staff || []).length;
    state.staff.push({
      id: 'st-' + Math.random().toString(36).slice(2, 8),
      name, role, color: STAFF_COLORS[idx % STAFF_COLORS.length],
      createdAt: nowIso(),
    });
    saveState();
    renderStaffList();
    renderMeStaffOptions();
    toast('담당자 추가됨', 'success');
    return true;
  }
  function deleteStaff(id) {
    const staff = findStaffById(id);
    if (!staff) return;
    if (!confirm(`'${staff.name}' 담당자를 목록에서 삭제할까요? 기존 피드백의 작성자명은 그대로 보존됩니다.`)) return;
    state.staff = (state.staff || []).filter(s => s.id !== id);
    if (getMeStaffId() === id) setMeStaffId(null);
    saveState();
    renderStaffList();
    renderMeStaffOptions();
    renderMeCard();
    toast('담당자 삭제됨', 'info');
  }
  function renderMeCard() {
    const me = getMeStaff();
    const av = document.getElementById('meAvatar');
    const nm = document.getElementById('meName');
    const rl = document.getElementById('meRole');
    if (!av || !nm || !rl) return;
    if (me) {
      av.textContent = staffInitial(me.name);
      av.style.background = staffColor(me);
      av.style.color = '#fff';
      nm.textContent = me.name;
      rl.textContent = me.role || '직함 없음';
    } else {
      av.textContent = '?';
      av.style.background = 'var(--light)';
      av.style.color = 'var(--muted)';
      nm.textContent = '설정 안 됨';
      rl.textContent = '이 기기에서 작성 시 자동 기록됩니다';
    }
  }

  // -------- 담당자 관리 모달 --------
  function openStaffModal() {
    document.getElementById('stfName').value = '';
    document.getElementById('stfRole').value = '';
    renderStaffList();
    openModal('staffModal');
    setTimeout(() => document.getElementById('stfName').focus(), 60);
  }
  function renderStaffList() {
    const wrap = document.getElementById('stfList');
    if (!wrap) return;
    const list = state.staff || [];
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-history">아직 등록된 담당자가 없습니다.<br/>위 입력란에 이름·직함을 적고 추가해 주세요.</div>';
      return;
    }
    wrap.innerHTML = '';
    list.forEach((s, idx) => {
      const row = document.createElement('div');
      row.className = 'staff-row';
      row.innerHTML = `
        <span class="staff-avatar" style="background:${escapeHtml(staffColor(s, idx))}">${escapeHtml(staffInitial(s.name))}</span>
        <div class="staff-meta">
          <div class="staff-name">${escapeHtml(s.name)}</div>
          <div class="staff-role">${escapeHtml(s.role || '직함 없음')}</div>
        </div>
        <div class="staff-actions">
          <button class="btn btn-sm btn-ghost" data-act="set-me">내 이름으로</button>
          <button class="btn btn-sm btn-danger" data-act="del" title="삭제">×</button>
        </div>
      `;
      row.querySelector('[data-act=set-me]').addEventListener('click', () => {
        setMeStaffId(s.id);
        toast(`'${s.name}' 님으로 설정됨`, 'success');
      });
      row.querySelector('[data-act=del]').addEventListener('click', () => deleteStaff(s.id));
      wrap.appendChild(row);
    });
  }

  // -------- 내 이름 설정 모달 --------
  function openMeModal() {
    renderMeStaffOptions();
    openModal('meModal');
  }
  function renderMeStaffOptions() {
    const wrap = document.getElementById('meStaffList');
    if (!wrap) return;
    const list = state.staff || [];
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-history">담당자가 등록돼 있지 않습니다. 먼저 <b>담당자 관리</b>에서 추가하세요.</div>';
      return;
    }
    const meId = getMeStaffId();
    wrap.innerHTML = '';
    list.forEach((s, idx) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'me-option' + (s.id === meId ? ' selected' : '');
      row.innerHTML = `
        <span class="staff-avatar" style="background:${escapeHtml(staffColor(s, idx))}">${escapeHtml(staffInitial(s.name))}</span>
        <div class="staff-meta">
          <div class="staff-name">${escapeHtml(s.name)}</div>
          <div class="staff-role">${escapeHtml(s.role || '직함 없음')}</div>
        </div>
        ${s.id === meId ? '<span class="me-check">✓</span>' : ''}
      `;
      row.addEventListener('click', () => {
        setMeStaffId(s.id);
        toast(`'${s.name}' 님으로 설정됨`, 'success');
      });
      wrap.appendChild(row);
    });
  }

  // -------- 피드백 데이터 모델 --------
  // target = { type: 'section', pageId, secId } | { type: 'page', pageId }
  function getFeedbackTarget(target) {
    if (!target) return null;
    const page = state.pages.find(p => p.id === target.pageId);
    if (!page) return null;
    if (target.type === 'page') return page;
    if (target.type === 'section') return page.sections.find(s => s.id === target.secId) || null;
    return null;
  }
  function targetLabel(target) {
    const page = state.pages.find(p => p.id === target.pageId);
    if (!page) return '(삭제됨)';
    if (target.type === 'page') return `${page.name} · 페이지 단위`;
    const sec = page.sections.find(s => s.id === target.secId);
    return `${page.name} · ${sec ? sec.name : '(삭제된 섹션)'}`;
  }
  function addFeedback(target, text) {
    const obj = getFeedbackTarget(target);
    if (!obj) { toast('대상을 찾을 수 없습니다.', 'error'); return false; }
    const trimmed = (text || '').trim();
    if (!trimmed) { toast('피드백 내용을 입력하세요.', 'error'); return false; }
    const me = getMeStaff();
    obj.feedbacks = obj.feedbacks || [];
    obj.feedbacks.unshift({
      id: 'fb-' + Math.random().toString(36).slice(2, 9),
      staffId: me ? me.id : null,
      staffName: me ? me.name : '익명',
      staffRole: me ? (me.role || '') : '',
      text: trimmed,
      createdAt: nowIso(),
    });
    saveState();
    return true;
  }
  function deleteFeedback(target, fbId) {
    const obj = getFeedbackTarget(target);
    if (!obj) return false;
    const me = getMeStaff();
    const fb = (obj.feedbacks || []).find(f => f.id === fbId);
    if (!fb) return false;
    if (fb.staffId && (!me || me.id !== fb.staffId)) {
      toast('본인이 작성한 피드백만 삭제할 수 있습니다.', 'error');
      return false;
    }
    if (!confirm('이 피드백을 휴지통으로 옮길까요? (7일간 보관 후 자동 영구 삭제)')) return false;
    obj.feedbacks = obj.feedbacks.filter(f => f.id !== fbId);
    state.trash = state.trash || { feedbacks: [] };
    state.trash.feedbacks = state.trash.feedbacks || [];
    state.trash.feedbacks.unshift({
      id: fb.id,
      target: { type: target.type, pageId: target.pageId, secId: target.secId || null },
      targetLabel: targetLabel(target),
      original: fb,
      deletedAt: nowIso(),
      deletedByStaffId: me ? me.id : null,
      deletedByName: me ? me.name : '익명',
    });
    saveState();
    return true;
  }

  // -------- 휴지통 (피드백 소프트 삭제) --------
  function purgeOldTrash() {
    state.trash = state.trash || { feedbacks: [] };
    const list = state.trash.feedbacks || [];
    if (list.length === 0) return 0;
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const kept = list.filter(t => {
      const d = new Date(t.deletedAt).getTime();
      return isFinite(d) && d >= cutoff;
    });
    const purged = list.length - kept.length;
    if (purged > 0) {
      state.trash.feedbacks = kept;
      saveState();
      console.log(`[trash] ${purged}건 영구 삭제 (7일 경과)`);
    }
    return purged;
  }
  function trashCount() {
    return ((state.trash && state.trash.feedbacks) || []).length;
  }
  function updateTrashCount() {
    const el = document.getElementById('trashCount');
    if (el) el.textContent = trashCount();
  }
  function restoreTrashItem(itemId) {
    const list = (state.trash && state.trash.feedbacks) || [];
    const idx = list.findIndex(t => t.id === itemId);
    if (idx < 0) return false;
    const item = list[idx];
    const obj = getFeedbackTarget(item.target);
    if (!obj) {
      toast('원래 위치(섹션/페이지)가 사라져 복원할 수 없습니다.', 'error');
      return false;
    }
    obj.feedbacks = obj.feedbacks || [];
    obj.feedbacks.unshift(item.original);
    state.trash.feedbacks.splice(idx, 1);
    saveState();
    return true;
  }
  function purgeTrashItem(itemId) {
    const list = (state.trash && state.trash.feedbacks) || [];
    const item = list.find(t => t.id === itemId);
    if (!item) return false;
    if (!confirm('이 항목을 지금 영구 삭제할까요? (복구 불가)')) return false;
    state.trash.feedbacks = list.filter(t => t.id !== itemId);
    saveState();
    return true;
  }
  function emptyTrashNow() {
    if (trashCount() === 0) { toast('휴지통이 비어 있습니다.', 'info'); return; }
    if (!confirm(`휴지통의 ${trashCount()}건을 모두 영구 삭제할까요? (복구 불가)`)) return;
    state.trash.feedbacks = [];
    saveState();
    renderTrashList();
    updateTrashCount();
    toast('휴지통 비우기 완료', 'info');
  }
  function daysLeft(deletedAt) {
    const exp = new Date(deletedAt).getTime() + TRASH_RETENTION_MS;
    const ms = exp - Date.now();
    if (ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }
  function openTrashModal() {
    renderTrashList();
    openModal('trashModal');
  }
  function renderTrashList() {
    const wrap = document.getElementById('trList');
    if (!wrap) return;
    const list = ((state.trash && state.trash.feedbacks) || []).slice()
      .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-history">휴지통이 비어 있습니다.<br/>삭제된 피드백은 7일간 보관 후 자동 영구 삭제됩니다.</div>';
      return;
    }
    wrap.innerHTML = '';
    list.forEach(item => {
      const fb = item.original || {};
      const left = daysLeft(item.deletedAt);
      const obj = getFeedbackTarget(item.target);
      const targetMissing = !obj;
      const row = document.createElement('div');
      row.className = 'tr-item' + (targetMissing ? ' tr-orphan' : '');
      row.innerHTML = `
        <div class="tr-head">
          <span class="tr-target" title="원래 위치">${escapeHtml(item.targetLabel || '(알 수 없음)')}${targetMissing ? ' <span class="tr-missing">대상 삭제됨</span>' : ''}</span>
          <span class="tr-left" title="${escapeHtml(fmtDate(item.deletedAt))} 삭제">D-${left}</span>
        </div>
        <div class="tr-body">
          <div class="tr-author">
            <b>${escapeHtml(fb.staffName || '익명')}</b>${fb.staffRole ? ' · ' + escapeHtml(fb.staffRole) : ''}
            <span class="tr-when">작성 ${escapeHtml(fmtDate(fb.createdAt))}</span>
          </div>
          <div class="tr-text">${escapeHtml(fb.text || '')}</div>
          <div class="tr-meta">
            🗑 ${escapeHtml(fmtDate(item.deletedAt))} · ${escapeHtml(item.deletedByName || '익명')} 삭제
          </div>
        </div>
        <div class="tr-actions">
          <button class="btn btn-sm btn-primary" data-act="restore" ${targetMissing ? 'disabled' : ''} title="${targetMissing ? '원래 위치가 사라져 복원 불가' : '원래 위치로 되돌리기'}">복원</button>
          <button class="btn btn-sm btn-danger" data-act="purge" title="지금 영구 삭제">영구 삭제</button>
        </div>
      `;
      const restoreBtn = row.querySelector('[data-act=restore]');
      if (restoreBtn && !targetMissing) {
        restoreBtn.addEventListener('click', () => {
          if (restoreTrashItem(item.id)) {
            renderTrashList();
            updateTrashCount();
            renderSections();
            updatePageFeedbackCount();
            toast('복원됨', 'success');
          }
        });
      }
      row.querySelector('[data-act=purge]').addEventListener('click', () => {
        if (purgeTrashItem(item.id)) {
          renderTrashList();
          updateTrashCount();
          toast('영구 삭제됨', 'info');
        }
      });
      wrap.appendChild(row);
    });
  }

  // -------- 피드백 모달 --------
  let feedbackCtx = null;
  function openFeedbackModalForSection(secId) {
    const page = getActivePage();
    const sec = getSection(page.id, secId);
    if (!sec) return;
    feedbackCtx = { type: 'section', pageId: page.id, secId };
    document.getElementById('fbTitle').textContent = `피드백 — ${sec.name}`;
    refreshFeedbackAuthorChip();
    document.getElementById('fbInput').value = '';
    renderFeedbackList();
    openModal('feedbackModal');
    setTimeout(() => document.getElementById('fbInput').focus(), 60);
  }
  function openFeedbackModalForPage() {
    const page = getActivePage();
    feedbackCtx = { type: 'page', pageId: page.id };
    document.getElementById('fbTitle').textContent = `피드백 — ${page.name} (페이지 단위)`;
    refreshFeedbackAuthorChip();
    document.getElementById('fbInput').value = '';
    renderFeedbackList();
    openModal('feedbackModal');
    setTimeout(() => document.getElementById('fbInput').focus(), 60);
  }
  function refreshFeedbackAuthorChip() {
    const chip = document.getElementById('fbAuthorChip');
    if (!chip) return;
    const me = getMeStaff();
    if (me) {
      chip.innerHTML = `작성자: <b style="color:${escapeHtml(staffColor(me))};">${escapeHtml(me.name)}</b>${me.role ? ' · ' + escapeHtml(me.role) : ''}`;
    } else {
      chip.innerHTML = '작성자 없음 (익명) — <a href="#" id="fbSetMeLink">내 이름 설정</a>';
      const link = chip.querySelector('#fbSetMeLink');
      if (link) link.addEventListener('click', e => { e.preventDefault(); closeModal('feedbackModal'); openMeModal(); });
    }
  }
  function renderFeedbackList() {
    if (!feedbackCtx) return;
    const obj = getFeedbackTarget(feedbackCtx);
    const wrap = document.getElementById('fbList');
    wrap.innerHTML = '';
    const list = (obj && obj.feedbacks) || [];
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-history">아직 기록된 피드백이 없습니다.</div>';
      return;
    }
    const me = getMeStaff();
    list.forEach(fb => {
      const row = document.createElement('div');
      row.className = 'fb-item';
      const canDelete = !fb.staffId || (me && me.id === fb.staffId);
      row.innerHTML = `
        <div class="fb-head">
          <span class="staff-avatar sm" style="background:${escapeHtml(staffColor(findStaffById(fb.staffId) || { color: '#6B7280' }))}">${escapeHtml(staffInitial(fb.staffName))}</span>
          <span class="fb-author"><b>${escapeHtml(fb.staffName || '익명')}</b>${fb.staffRole ? ' · ' + escapeHtml(fb.staffRole) : ''}</span>
          <span class="fb-when">${escapeHtml(fmtDate(fb.createdAt))}</span>
          ${canDelete ? '<button class="fb-del" title="삭제" data-act="del">×</button>' : ''}
        </div>
        <div class="fb-text">${escapeHtml(fb.text)}</div>
      `;
      const del = row.querySelector('[data-act=del]');
      if (del) del.addEventListener('click', () => {
        if (deleteFeedback(feedbackCtx, fb.id)) {
          renderFeedbackList();
          renderSections();
          updatePageFeedbackCount();
          toast('삭제됨', 'info');
        }
      });
      wrap.appendChild(row);
    });
  }
  function submitFeedback() {
    if (!feedbackCtx) return;
    const input = document.getElementById('fbInput');
    if (addFeedback(feedbackCtx, input.value)) {
      input.value = '';
      renderFeedbackList();
      renderSections();
      updatePageFeedbackCount();
      toast('피드백 기록됨', 'success');
    }
  }

  function updatePageFeedbackCount() {
    const el = document.getElementById('pageFbCount');
    if (!el) return;
    const page = getActivePage();
    el.textContent = ((page && page.feedbacks) || []).length;
  }

  // -------- 작업여정(통합 타임라인) 모달 --------
  function openJourneyModal() {
    const page = getActivePage();
    document.getElementById('jnTitle').textContent = `작업여정 — ${page.name}`;
    renderJourney();
    openModal('journeyModal');
  }
  function buildJourneyEntries(page) {
    const entries = [];
    // 페이지 단위 피드백
    (page.feedbacks || []).forEach(fb => entries.push({
      type: 'feedback', when: fb.createdAt,
      title: '💬 페이지 피드백', author: fb.staffName, role: fb.staffRole, body: fb.text, scope: '페이지'
    }));
    // 섹션 단위
    page.sections.forEach(sec => {
      (sec.feedbacks || []).forEach(fb => entries.push({
        type: 'feedback', when: fb.createdAt,
        title: `💬 ${sec.name}`, author: fb.staffName, role: fb.staffRole, body: fb.text, scope: '섹션'
      }));
      const hList = state.history[histKey(page.id, sec.id)] || [];
      hList.forEach(v => {
        const isStatus = v.kind && v.kind !== 'edit' && v.kind !== 'restore';
        entries.push({
          type: isStatus ? 'status' : 'edit',
          when: v.savedAt,
          title: (isStatus ? '◐ ' : '✎ ') + sec.name,
          author: '', role: '',
          body: v.reason || '(사유 없음)',
          scope: kindLabelShort(v.kind),
        });
      });
    });
    entries.sort((a, b) => (b.when || '').localeCompare(a.when || ''));
    return entries;
  }
  function kindLabelShort(k) {
    return k === 'wip'          ? '작업중' :
           k === 'request'      ? '컨펌요청' :
           k === 'approve'      ? '승인' :
           k === 'revision'     ? '재수정' :
           k === 'reset-status' ? '초안화' :
           k === 'restore'      ? '복원' :
           k === 'confirm'      ? '컨펌' :
           k === 'unconfirm'    ? '컨펌해제' : '편집';
  }
  function renderJourney() {
    const page = getActivePage();
    const wrap = document.getElementById('jnList');
    const filters = Array.from(document.querySelectorAll('[data-jn-type]'))
      .filter(c => c.checked).map(c => c.dataset.jnType);
    const all = buildJourneyEntries(page).filter(e => filters.indexOf(e.type) !== -1);
    wrap.innerHTML = '';
    if (all.length === 0) {
      wrap.innerHTML = '<div class="empty-history">표시할 항목이 없습니다.</div>';
      return;
    }
    all.forEach(e => {
      const row = document.createElement('div');
      row.className = 'jn-item jn-' + e.type;
      row.innerHTML = `
        <div class="jn-when">${escapeHtml(fmtDate(e.when))}</div>
        <div class="jn-body">
          <div class="jn-title">
            <span class="jn-scope">${escapeHtml(e.scope)}</span>
            <span>${escapeHtml(e.title)}</span>
            ${e.author ? `<span class="jn-author">— ${escapeHtml(e.author)}${e.role ? ' · ' + escapeHtml(e.role) : ''}</span>` : ''}
          </div>
          <div class="jn-text">${escapeHtml(e.body)}</div>
        </div>
      `;
      wrap.appendChild(row);
    });
  }

  // -------- 이동(부모 변경) 모달 --------
  function openMoveModal() {
    const node = getActiveNode();
    if (!node) { toast('이동할 항목을 먼저 선택하세요.', 'error'); return; }
    document.getElementById('mvTitle').textContent = `'${node.name}' 이동`;
    document.getElementById('mvCurrent').textContent = currentPathLabel(node);
    renderMoveOptions(node);
    openModal('moveModal');
  }
  function currentPathLabel(node) {
    const parts = [];
    let cur = node;
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? state.pages.find(p => p.id === cur.parentId) : null;
    }
    return parts.join(' / ') || '(최상위)';
  }
  function renderMoveOptions(node) {
    const sel = document.getElementById('mvParent');
    sel.innerHTML = '';
    // (최상위) 옵션
    const topOpt = document.createElement('option');
    topOpt.value = '__root__';
    const topOK = canMoveTo(node.id, null);
    topOpt.textContent = '📂 (최상위 — 대분류)' + (topOK ? '' : ' — 깊이 초과로 불가');
    if (!topOK) topOpt.disabled = true;
    sel.appendChild(topOpt);
    // 모든 폴더를 트리 순서로
    const walk = (parentId, depth) => {
      getChildren(parentId).filter(p => p.type === 'folder').forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        const indent = '— '.repeat(depth);
        const ok = canMoveTo(node.id, f.id) && f.id !== node.parentId;
        opt.textContent = `${indent}📁 ${f.name} (${depthLabel(depth)})${ok ? '' : (f.id === node.parentId ? ' — 현재 위치' : ' — 이동 불가')}`;
        if (!ok) opt.disabled = true;
        sel.appendChild(opt);
        walk(f.id, depth + 1);
      });
    };
    walk(null, 0);
    // 현재 부모로 기본 선택
    sel.value = node.parentId || '__root__';
  }
  function applyMove() {
    const node = getActiveNode();
    if (!node) return;
    const sel = document.getElementById('mvParent');
    const newParentId = sel.value === '__root__' ? null : sel.value;
    if ((node.parentId || null) === (newParentId || null)) {
      closeModal('moveModal'); toast('현재 위치와 동일합니다.', 'info'); return;
    }
    if (!canMoveTo(node.id, newParentId)) {
      toast('해당 위치로는 이동할 수 없습니다 (깊이 초과 또는 자기 자신·후손).', 'error');
      return;
    }
    node.parentId = newParentId;
    if (newParentId) { collapsedFolders.delete(newParentId); saveCollapsed(); } // 이동 후 부모 펼치기
    saveState();
    closeModal('moveModal');
    renderAll();
    toast(`이동 완료 → ${currentPathLabel(node)}`, 'success');
  }

  // -------- 상세페이지 템플릿 (Step A) --------
  const SLOT_TYPES = [
    { value: 'text',     label: '한 줄 텍스트' },
    { value: 'textarea', label: '여러 줄 텍스트' },
    { value: 'image',    label: '이미지 URL' },
    { value: 'link',     label: '링크 URL' },
  ];
  function extractSlotKeys(html) {
    const seen = [];
    const re = /\{\{\s*([A-Za-z][\w-]*)\s*\}\}/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (seen.indexOf(m[1]) === -1) seen.push(m[1]);
    }
    return seen;
  }
  function inferSlotType(key) {
    const k = key.toLowerCase();
    if (/(img|image|photo|thumb|thumbnail|banner|hero|cover|gallery|pic)/.test(k)) return 'image';
    if (/(desc|content|body|review|story|detail|long)/.test(k)) return 'textarea';
    if (/(url|link|href|cta)/.test(k)) return 'link';
    return 'text';
  }
  function inferSlotLabel(key) {
    // camelCase / snake_case → 사람용 라벨
    const spaced = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .trim()
      .toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
  function newTemplate() {
    return {
      id: 'tpl-' + Math.random().toString(36).slice(2, 8),
      name: '새 템플릿',
      description: '',
      html: '',
      slots: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  // 슬롯 정의 동기화: HTML에 있는 키만 살리고, 새 키는 추가, 기존 키는 사용자 설정 유지
  function syncSlotsWithHtml(tpl) {
    const keys = extractSlotKeys(tpl.html);
    const byKey = Object.create(null);
    (tpl.slots || []).forEach(s => { byKey[s.key] = s; });
    tpl.slots = keys.map(k => byKey[k] || {
      key: k,
      type: inferSlotType(k),
      label: inferSlotLabel(k),
      defaultValue: '',
      required: false,
    });
  }
  function findTemplate(id) { return (state.templates || []).find(t => t.id === id) || null; }
  function saveTemplate(tpl) {
    syncSlotsWithHtml(tpl);
    tpl.updatedAt = nowIso();
    state.templates = state.templates || [];
    const idx = state.templates.findIndex(t => t.id === tpl.id);
    if (idx >= 0) state.templates[idx] = tpl;
    else { tpl.createdAt = tpl.createdAt || nowIso(); state.templates.push(tpl); }
    saveState();
  }
  function deleteTemplate(id) {
    const tpl = findTemplate(id);
    if (!tpl) return;
    if (!confirm(`'${tpl.name}' 템플릿을 삭제할까요?`)) return;
    state.templates = (state.templates || []).filter(t => t.id !== id);
    saveState();
    renderTemplateList();
    toast('템플릿 삭제됨', 'info');
  }

  // POUR 기본 14섹션 템플릿 가져오기
  async function loadPourDefaultTemplate() {
    try {
      const res = await fetch('./templates/pour-default-detail-v1.html', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const tpl = newTemplate();
      tpl.name = 'POUR 기본 상세페이지 v1';
      tpl.description = '14섹션 (인트로·사용처·데이터·시험성적서·기능·B/A·CTA·사례·컬러·주의·단계·FAQ·브랜드) — 마지막 브랜드 섹션 고정';
      tpl.html = html;
      syncSlotsWithHtml(tpl);
      // 슬롯 라벨을 섹션 단위로 정돈
      tpl.slots.forEach(s => { s.label = friendlyLabelForKey(s.key); });
      state.templates = state.templates || [];
      state.templates.push(tpl);
      saveState();
      renderTemplateList();
      toast(`'${tpl.name}' 템플릿이 추가됐습니다 (슬롯 ${tpl.slots.length}개)`, 'success');
      if (document.body.getAttribute('data-mode') === 'product') refreshProductDashboard();
    } catch (e) {
      console.error('[templates] POUR 기본 템플릿 로드 실패:', e);
      toast('템플릿 파일 로드 실패: ' + e.message, 'error');
    }
  }
  // 키별 한국어 라벨 매핑
  function friendlyLabelForKey(k) {
    const map = {
      intro_headline: '[1] 인트로 헤드라인', intro_image: '[1] 인트로 이미지',
      intro_bullet1: '[1] 포인트 1', intro_bullet2: '[1] 포인트 2', intro_bullet3: '[1] 포인트 3',
      usecase_image1: '[2] 사용처 사진 1', usecase_image2: '[2] 사용처 사진 2',
      usecase_image3: '[2] 사용처 사진 3', usecase_image4: '[2] 사용처 사진 4',
      usecase_summary: '[2] 사용처 한 줄 카피',
      usecase_tag1: '[2] 키워드 1', usecase_tag2: '[2] 키워드 2', usecase_tag3: '[2] 키워드 3',
      usecase_tag4: '[2] 키워드 4', usecase_tag5: '[2] 키워드 5', usecase_tag6: '[2] 키워드 6',
      usecase_footnote: '[2] 사용처 주석',
      data_headline: '[3] 데이터 헤드라인',
      data_value1: '[3] 핵심 수치 1', data_unit1: '[3] 단위 1', data_label1: '[3] 라벨 1',
      data_value2: '[3] 핵심 수치 2', data_unit2: '[3] 단위 2', data_label2: '[3] 라벨 2',
      cert_image: '[4] 시험성적서 사진', cert_caption: '[4] 시험기관 캡션',
      feat_overview_title: '[5] 기능 4종 타이틀',
      feat_card1_title: '[5] 카드 1 라벨', feat_card1_image: '[5] 카드 1 이미지',
      feat_card2_title: '[5] 카드 2 라벨', feat_card2_image: '[5] 카드 2 이미지',
      feat_card3_title: '[5] 카드 3 라벨', feat_card3_image: '[5] 카드 3 이미지',
      feat_card4_title: '[5] 카드 4 라벨', feat_card4_image: '[5] 카드 4 이미지',
      featdetail_1_title: '[6] 기능1 제목', featdetail_1_body: '[6] 기능1 본문', featdetail_1_image: '[6] 기능1 이미지',
      featdetail_2_title: '[6] 기능2 제목', featdetail_2_body: '[6] 기능2 본문', featdetail_2_image: '[6] 기능2 이미지',
      featdetail_3_title: '[6] 기능3 제목', featdetail_3_body: '[6] 기능3 본문', featdetail_3_image: '[6] 기능3 이미지',
      featdetail_4_title: '[6] 기능4 제목', featdetail_4_body: '[6] 기능4 본문', featdetail_4_image: '[6] 기능4 이미지',
      ba_before: '[7] BEFORE 사진', ba_after: '[7] AFTER 사진', ba_caption: '[7] B/A 캡션',
      cta_headline: '[8] CTA 헤드라인',
      cta_concern1: '[8] 고민 1', cta_concern2: '[8] 고민 2', cta_concern3: '[8] 고민 3', cta_concern4: '[8] 고민 4',
      cta_link: '[8] 구매 링크', cta_button_label: '[8] 버튼 텍스트',
      trust_title: '[9] 사례 타이틀', trust_subhead: '[9] 사례 서브헤드',
      trust_image1: '[9] 사례 이미지 1', trust_image2: '[9] 사례 이미지 2', trust_image3: '[9] 사례 이미지 3',
      trust_image4: '[9] 사례 이미지 4', trust_image5: '[9] 사례 이미지 5', trust_image6: '[9] 사례 이미지 6',
      color_image1: '[10] 컬러 칩 1', color_label1: '[10] 컬러 라벨 1',
      color_image2: '[10] 컬러 칩 2', color_label2: '[10] 컬러 라벨 2',
      color_image3: '[10] 컬러 칩 3', color_label3: '[10] 컬러 라벨 3',
      warn_1: '[11] 주의 1', warn_2: '[11] 주의 2', warn_3: '[11] 주의 3', warn_4: '[11] 주의 4', warn_5: '[11] 주의 5',
      step_1_title: '[12] 단계1 제목', step_1_body: '[12] 단계1 본문', step_1_image: '[12] 단계1 이미지',
      step_2_title: '[12] 단계2 제목', step_2_body: '[12] 단계2 본문', step_2_image: '[12] 단계2 이미지',
      step_3_title: '[12] 단계3 제목', step_3_body: '[12] 단계3 본문', step_3_image: '[12] 단계3 이미지',
      step_4_title: '[12] 단계4 제목', step_4_body: '[12] 단계4 본문', step_4_image: '[12] 단계4 이미지',
      faq_q1: '[13] Q1', faq_a1: '[13] A1', faq_q2: '[13] Q2', faq_a2: '[13] A2',
      faq_q3: '[13] Q3', faq_a3: '[13] A3', faq_q4: '[13] Q4', faq_a4: '[13] A4',
      faq_q5: '[13] Q5', faq_a5: '[13] A5',
    };
    return map[k] || inferSlotLabel(k);
  }

  // 템플릿 목록 모달
  function openTemplatesModal() {
    renderTemplateList();
    openModal('templatesModal');
  }
  function renderTemplateList() {
    const wrap = document.getElementById('tplList');
    if (!wrap) return;
    const list = (state.templates || []).slice()
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-history">아직 등록된 템플릿이 없습니다.<br/>위 <b>+ 새 템플릿</b> 버튼으로 시작하세요.</div>';
      return;
    }
    wrap.innerHTML = '';
    list.forEach(t => {
      const slotCount = (t.slots || []).length;
      const row = document.createElement('div');
      row.className = 'tpl-row';
      row.innerHTML = `
        <div class="tpl-meta">
          <div class="tpl-name">📐 ${escapeHtml(t.name)}</div>
          <div class="tpl-desc">${escapeHtml(t.description || '설명 없음')}</div>
          <div class="tpl-stats">
            <span>슬롯 ${slotCount}개</span>
            <span>·</span>
            <span title="${escapeHtml(fmtDate(t.updatedAt))}">${escapeHtml(fmtDate(t.updatedAt))}</span>
          </div>
        </div>
        <div class="tpl-actions">
          <button class="btn btn-sm btn-primary" data-act="edit">편집</button>
          <button class="btn btn-sm btn-danger" data-act="del" title="삭제">×</button>
        </div>
      `;
      row.querySelector('[data-act=edit]').addEventListener('click', () => openTemplateEditor(t.id));
      row.querySelector('[data-act=del]').addEventListener('click', () => deleteTemplate(t.id));
      wrap.appendChild(row);
    });
  }

  // 템플릿 편집 모달
  let templateEditorCtx = null;
  function openTemplateEditor(tplId) {
    const tpl = tplId ? findTemplate(tplId) : null;
    templateEditorCtx = tpl ? JSON.parse(JSON.stringify(tpl)) : newTemplate();
    document.getElementById('teTitle').textContent = tpl ? `템플릿 편집 — ${tpl.name}` : '새 템플릿 만들기';
    document.getElementById('teName').value = templateEditorCtx.name;
    document.getElementById('teDesc').value = templateEditorCtx.description || '';
    document.getElementById('teHtml').value = templateEditorCtx.html || '';
    syncSlotsWithHtml(templateEditorCtx);
    renderTemplateSlots();
    refreshTemplatePreview();
    openModal('templateEditor');
    setTimeout(() => document.getElementById('teName').focus(), 60);
  }
  function renderTemplateSlots() {
    const wrap = document.getElementById('teSlots');
    if (!wrap || !templateEditorCtx) return;
    const slots = templateEditorCtx.slots || [];
    if (slots.length === 0) {
      wrap.innerHTML = '<div class="empty-history" style="padding:18px 10px;">HTML에 <code>{{슬롯키}}</code> 형태로 플레이스홀더를 넣으면 여기 자동으로 나타납니다.<br/>예: <code>&lt;h1&gt;{{title}}&lt;/h1&gt;</code></div>';
      return;
    }
    wrap.innerHTML = '';
    slots.forEach((s, idx) => {
      const row = document.createElement('div');
      row.className = 'te-slot';
      row.innerHTML = `
        <span class="te-slot-key" title="HTML의 {{${escapeHtml(s.key)}}}와 매칭됨">{{${escapeHtml(s.key)}}}</span>
        <input type="text" class="te-slot-label" value="${escapeHtml(s.label || '')}" placeholder="라벨 (예: 상품명)" />
        <select class="te-slot-type">
          ${SLOT_TYPES.map(t => `<option value="${t.value}"${s.type === t.value ? ' selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <input type="text" class="te-slot-default" value="${escapeHtml(s.defaultValue || '')}" placeholder="기본값 (선택)" />
      `;
      row.querySelector('.te-slot-label').addEventListener('input', e => {
        templateEditorCtx.slots[idx].label = e.target.value;
      });
      row.querySelector('.te-slot-type').addEventListener('change', e => {
        templateEditorCtx.slots[idx].type = e.target.value;
      });
      row.querySelector('.te-slot-default').addEventListener('input', e => {
        templateEditorCtx.slots[idx].defaultValue = e.target.value;
        refreshTemplatePreview();
      });
      wrap.appendChild(row);
    });
  }
  function refreshTemplatePreview() {
    const frame = document.getElementById('tePreview');
    if (!frame || !templateEditorCtx) return;
    let html = templateEditorCtx.html || '';
    (templateEditorCtx.slots || []).forEach(s => {
      const placeholder = (s.defaultValue !== '' && s.defaultValue != null)
        ? s.defaultValue
        : `[${s.label || s.key}]`;
      const re = new RegExp('\\{\\{\\s*' + s.key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*\\}\\}', 'g');
      html = html.replace(re, placeholder);
    });
    frame.srcdoc = wrapPreview(html);
  }
  function refreshSlotsAfterHtmlChange() {
    if (!templateEditorCtx) return;
    templateEditorCtx.html = document.getElementById('teHtml').value;
    syncSlotsWithHtml(templateEditorCtx);
    renderTemplateSlots();
    refreshTemplatePreview();
  }
  function saveTemplateEditor() {
    if (!templateEditorCtx) return;
    const name = document.getElementById('teName').value.trim();
    if (!name) { toast('템플릿 이름을 입력하세요.', 'error'); return; }
    templateEditorCtx.name = name;
    templateEditorCtx.description = document.getElementById('teDesc').value.trim();
    templateEditorCtx.html = document.getElementById('teHtml').value;
    saveTemplate(templateEditorCtx);
    closeModal('templateEditor');
    renderTemplateList();
    toast('템플릿 저장됨', 'success');
  }

  // ════════════════════════════════════════════════════════════════
  // 📦 제품 관리 (마스터) — Stage 0
  // ════════════════════════════════════════════════════════════════
  // 모제품(POUR코트재 등)의 객관적 사실을 한 번 등록 → 자식 상품(목재페인트 등)에서 재활용.
  // 자식 상품 컬렉션(pourstore-renewal-listings)은 다음 단계에서 추가.
  const PRODUCTS_COLLECTION = 'pourstore-renewal-products';
  let productsCache = [];
  let productEditorCtx = null; // { productId, draft, sourcePdfs, dirty, mode }

  function newProduct() {
    return {
      id: 'prod-' + Math.random().toString(36).slice(2, 10),
      productCode: '',
      name: '',
      description: '',
      sources: { pdfs: [], texts: [] }, // pdfs: [{name,size,base64}] — Firestore 저장 시 base64 제외
      sourcePdfMeta: [], // [{name,size,uploadedAt}] — Firestore 영속 (base64는 추출 직후 메모리에서 폐기 가능)
      sharedImages: { cert: null, dataChart: null, patent: null, certMark: null }, // {url,caption}
      masterFacts: emptyMasterFacts(),
      factsExtractedAt: null,
      factsApproved: false,
      factsApprovedAt: null,
      factsApprovedBy: null,
      createdAt: null, updatedAt: null, deleted: false,
    };
  }
  function emptyMasterFacts() {
    return {
      productName: '',
      keySpecs: [],          // [{id,label,value,unit,source,kind,confidence,approved}]
      sellingPoints: [],     // [{id,text,source,confidence,approved}]
      composition: [],       // [{id,text,source,confidence,approved}]
      certifications: [],    // [{id,name,agency,source,confidence,approved}]
      compatibleSubstrates: [], // [{id,name,source,approved}]
      targetUses: [],        // [{id,text,source,confidence,approved}]
      cautions: [],          // [{id,text,source,confidence,approved}]
    };
  }
  function newFactId(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 8);
  }

  async function loadProducts() {
    if (!firebaseReady || !db) {
      toast('Firebase 미연결 — 제품 목록 로드 불가', 'error');
      return [];
    }
    try {
      const snap = await db.collection(PRODUCTS_COLLECTION).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.deleted);
      docs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      productsCache = docs;
      console.log(`[products] ${docs.length}건 로드`);
      return docs;
    } catch (e) {
      console.error('[products] 로드 실패:', e);
      toast('제품 목록 로드 실패: ' + (e.code || e.message || ''), 'error');
      return [];
    }
  }
  async function saveProduct(prod) {
    if (!firebaseReady || !db) { toast('오프라인 — 저장 불가', 'error'); return false; }
    const me = getMeStaff();
    prod.updatedAt = nowIso();
    prod.updatedByName = me ? me.name : '익명';
    if (!prod.createdAt) {
      prod.createdAt = prod.updatedAt;
      prod.createdByName = me ? me.name : '익명';
    }
    // base64 PDF는 Firestore에 안 들어감 (1MB 한도) — sourcePdfMeta로 메타만 보관
    const persisted = JSON.parse(JSON.stringify(prod));
    delete persisted.sources;
    try {
      await db.collection(PRODUCTS_COLLECTION).doc(prod.id).set(persisted, { merge: false });
      const idx = productsCache.findIndex(p => p.id === prod.id);
      if (idx >= 0) productsCache[idx] = persisted; else productsCache.unshift(persisted);
      return true;
    } catch (e) {
      console.error('[products] 저장 실패:', e);
      toast('저장 실패: ' + (e.code || e.message || ''), 'error');
      return false;
    }
  }
  async function deleteProduct(id) {
    const prod = productsCache.find(p => p.id === id);
    if (!prod) return;
    if (!confirm(`'${prod.name || prod.productCode}' 제품을 삭제할까요? (자식 상품이 있으면 그 상품들의 사실 참조가 끊깁니다)`)) return;
    if (!firebaseReady || !db) { toast('오프라인 — 삭제 불가', 'error'); return; }
    try {
      // 소프트 딜리트
      await db.collection(PRODUCTS_COLLECTION).doc(id).update({ deleted: true, deletedAt: nowIso() });
      productsCache = productsCache.filter(p => p.id !== id);
      renderProductList();
      toast('삭제됨', 'info');
    } catch (e) {
      console.error('[products] 삭제 실패:', e);
      toast('삭제 실패: ' + (e.code || e.message || ''), 'error');
    }
  }

  // -------- 제품 목록 모달 --------
  async function openProductsModal() {
    document.getElementById('prListWrap').innerHTML = '<div class="pr-empty">불러오는 중...</div>';
    openModal('productsModal');
    await loadProducts();
    renderProductList();
  }
  function renderProductList() {
    const wrap = document.getElementById('prListWrap');
    if (!productsCache.length) {
      wrap.innerHTML = `<div class="pr-empty">아직 등록된 제품이 없습니다.<br/>오른쪽 위 <b>+ 새 제품</b> 버튼으로 시작하세요.</div>`;
      return;
    }
    const list = document.createElement('div');
    list.className = 'pr-list';
    productsCache.forEach(p => {
      const card = document.createElement('div');
      card.className = 'pr-card';
      const factsCount = countApprovedFacts(p.masterFacts);
      const totalCount = countTotalFacts(p.masterFacts);
      const sharedCount = ['cert','dataChart','patent','certMark']
        .filter(k => p.sharedImages && p.sharedImages[k] && p.sharedImages[k].url).length;
      let badge;
      if (p.factsApproved) badge = `<span class="pr-badge pr-badge-approved">✓ 검수 완료</span>`;
      else if (p.factsExtractedAt) badge = `<span class="pr-badge pr-badge-pending">검수 대기</span>`;
      else badge = `<span class="pr-badge pr-badge-empty">사실 미추출</span>`;
      card.innerHTML = `
        <div class="pr-card-main">
          <div class="pr-card-title">
            ${escapeHtml(p.name || '(이름 없음)')}
            ${p.productCode ? `<span class="pr-card-code">${escapeHtml(p.productCode)}</span>` : ''}
          </div>
          <div class="pr-card-desc">${escapeHtml(p.description || '')}</div>
          <div class="pr-card-meta">
            <span>📄 자료 <b>${(p.sourcePdfMeta || []).length}</b>개</span>
            <span>✓ 사실 <b>${factsCount}</b>/${totalCount}</span>
            <span>🖼 공유이미지 <b>${sharedCount}</b>/4</span>
          </div>
        </div>
        <div class="pr-card-badges">${badge}</div>
      `;
      card.addEventListener('click', () => openProductEditor(p.id));
      list.appendChild(card);
    });
    wrap.innerHTML = '';
    wrap.appendChild(list);
  }
  function countTotalFacts(f) {
    if (!f) return 0;
    return (f.keySpecs || []).length + (f.sellingPoints || []).length + (f.composition || []).length
      + (f.certifications || []).length + (f.compatibleSubstrates || []).length
      + (f.targetUses || []).length + (f.cautions || []).length;
  }
  function countApprovedFacts(f) {
    if (!f) return 0;
    const lists = ['keySpecs','sellingPoints','composition','certifications','compatibleSubstrates','targetUses','cautions'];
    return lists.reduce((sum, k) => sum + (f[k] || []).filter(it => it.approved).length, 0);
  }

  // -------- 제품 편집기 --------
  function openProductEditor(productId) {
    const isNew = !productId;
    const draft = isNew
      ? newProduct()
      : JSON.parse(JSON.stringify(productsCache.find(p => p.id === productId) || newProduct()));
    if (!draft.masterFacts) draft.masterFacts = emptyMasterFacts();
    if (!draft.sharedImages) draft.sharedImages = { cert: null, dataChart: null, patent: null, certMark: null };
    if (!draft.sourcePdfMeta) draft.sourcePdfMeta = [];
    productEditorCtx = {
      productId: draft.id,
      draft,
      sourcePdfs: [], // 메모리 전용 [{name,size,base64}] — 사실 추출 시 사용
      mode: isNew ? 'new' : 'edit',
    };
    document.getElementById('peTitle').textContent = isNew ? '+ 새 제품' : `제품 편집: ${draft.name || draft.productCode || ''}`;
    document.getElementById('peDelete').style.display = isNew ? 'none' : '';
    // 기본정보 채우기
    document.getElementById('peCode').value = draft.productCode || '';
    document.getElementById('peName').value = draft.name || '';
    document.getElementById('peDesc').value = draft.description || '';
    // 자료 (PDF는 메모리 전용이라 빈 채로 시작 — 메타만 표시)
    document.getElementById('peOwnText').value = (draft.sources && draft.sources.texts && draft.sources.texts[0] && draft.sources.texts[0].text) || '';
    document.getElementById('peOwnFile').value = '';
    renderProductSourceFiles();
    // 사실 카드
    renderProductFacts();
    updateProductApproveButton();
    // 공유 이미지
    renderProductSharedImages();
    // 첫 탭으로
    switchProductTab('basic');
    openModal('productEditor');
  }
  function switchProductTab(tab) {
    document.querySelectorAll('#productEditor .pe-tab').forEach(b => {
      b.classList.toggle('pe-tab-active', b.dataset.tab === tab);
    });
    ['basic','sources','facts','shared'].forEach(t => {
      const el = document.getElementById('peTab' + t.charAt(0).toUpperCase() + t.slice(1));
      if (el) el.style.display = (t === tab) ? '' : 'none';
    });
  }
  function renderProductSourceFiles() {
    const wrap = document.getElementById('peOwnFiles');
    wrap.innerHTML = '';
    const ctx = productEditorCtx;
    if (!ctx) return;
    // 1) 메모리에 들어와 있는 새 PDF (이번 편집에서 추가됨, base64 보유)
    ctx.sourcePdfs.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'af-file';
      row.innerHTML = `
        <span class="af-file-icon">📄</span>
        <span class="af-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="af-file-size">${fmtBytes(f.size)}</span>
        <span class="af-file-size" style="color:#059669; font-weight:700;">새 자료</span>
        <button type="button" class="af-file-rm" aria-label="제거">×</button>
      `;
      row.querySelector('.af-file-rm').addEventListener('click', () => {
        ctx.sourcePdfs.splice(idx, 1);
        renderProductSourceFiles();
      });
      wrap.appendChild(row);
    });
    // 2) 이전에 저장된 메타 (base64 없음)
    (ctx.draft.sourcePdfMeta || []).forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'af-file';
      row.style.opacity = '.7';
      row.innerHTML = `
        <span class="af-file-icon">📄</span>
        <span class="af-file-name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</span>
        <span class="af-file-size">${fmtBytes(m.size || 0)}</span>
        <span class="af-file-size" style="color:var(--muted);">기존 (재추출 시 다시 업로드)</span>
        <button type="button" class="af-file-rm" aria-label="제거" title="메타 제거 (사실 카드는 보존)">×</button>
      `;
      row.querySelector('.af-file-rm').addEventListener('click', () => {
        ctx.draft.sourcePdfMeta.splice(idx, 1);
        renderProductSourceFiles();
      });
      wrap.appendChild(row);
    });
  }
  async function addProductPdf(file) {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast('PDF 파일만 가능합니다', 'error'); return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast('PDF가 너무 큽니다 (최대 30MB)', 'error'); return;
    }
    try {
      const base64 = await readPdfAsBase64(file);
      productEditorCtx.sourcePdfs.push({ name: file.name, size: file.size, base64 });
      renderProductSourceFiles();
    } catch (e) {
      console.error('[products] PDF 읽기 실패:', e);
      toast('PDF 읽기 실패: ' + e.message, 'error');
    }
  }

  function renderProductFacts() {
    const wrap = document.getElementById('peFactsBody');
    wrap.innerHTML = '';
    const f = productEditorCtx.draft.masterFacts;
    if (!f) return;
    // 그룹별 렌더
    wrap.appendChild(renderFactGroup('keySpecs', '핵심 수치 (Specs)', '인장강도·부착강도·중성화 깊이 등 측정 가능한 수치'));
    wrap.appendChild(renderFactGroup('sellingPoints', '소구점 (Selling Points)', '경쟁 우위·핵심 차별점'));
    wrap.appendChild(renderSubstrateGroup());
    wrap.appendChild(renderFactGroup('targetUses', '적용 대상 / 용도', '어디에 쓰는지 — 옥상·외벽·바닥 등'));
    wrap.appendChild(renderFactGroup('certifications', '인증·시험 기관', 'KTR·KCL·국토부 신기술 등'));
    wrap.appendChild(renderFactGroup('composition', '성분·구성', '재료 구성·작동 원리'));
    wrap.appendChild(renderFactGroup('cautions', '주의사항', '시공 전 확인사항·금기'));
  }
  function renderFactGroup(groupKey, title, hint) {
    const f = productEditorCtx.draft.masterFacts;
    const items = f[groupKey] || [];
    const wrap = document.createElement('div');
    wrap.className = 'pe-facts-group';
    const head = document.createElement('div');
    head.className = 'pe-facts-group-head';
    head.innerHTML = `<span>${escapeHtml(title)} <span class="pe-facts-count">${items.filter(it => it.approved).length} / ${items.length}</span></span>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'pe-facts-group-add'; addBtn.textContent = '+ 직접 추가';
    addBtn.addEventListener('click', () => {
      const tpl = groupKey === 'keySpecs'
        ? { id: newFactId('spec'), label: '', value: '', unit: '', source: '직접 추가', kind: 'declared', confidence: 1, approved: true }
        : (groupKey === 'certifications')
          ? { id: newFactId('cert'), name: '', agency: '', source: '직접 추가', confidence: 1, approved: true }
          : { id: newFactId(groupKey.slice(0, 3)), text: '', source: '직접 추가', confidence: 1, approved: true };
      f[groupKey] = items;
      f[groupKey].push(tpl);
      renderProductFacts();
    });
    head.appendChild(addBtn);
    wrap.appendChild(head);
    const body = document.createElement('div');
    body.className = 'pe-facts-group-body';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'pe-facts-group-empty';
      empty.textContent = `아직 ${title} 없음 — 자료 추출 또는 직접 추가`;
      body.appendChild(empty);
    } else {
      items.forEach((it, idx) => body.appendChild(renderFactRow(groupKey, it, idx)));
    }
    wrap.appendChild(body);
    return wrap;
  }
  function renderFactRow(groupKey, it, idx) {
    const row = document.createElement('div');
    row.className = 'pe-fact-row' + (it.approved ? '' : ' pe-fact-rejected');
    const conf = typeof it.confidence === 'number' ? Math.round(it.confidence * 100) : null;
    const confCls = conf == null ? '' : (conf >= 80 ? 'pe-fact-confidence-high' : (conf >= 50 ? 'pe-fact-confidence-mid' : 'pe-fact-confidence-low'));

    let fieldsHtml = '';
    if (groupKey === 'keySpecs') {
      fieldsHtml = `
        <div class="pe-fact-fields">
          <input class="pe-fact-label-input" placeholder="항목" value="${escapeHtml(it.label || '')}" data-field="label" />
          <input class="pe-fact-value-input" placeholder="수치" value="${escapeHtml(it.value || '')}" data-field="value" />
          <input class="pe-fact-unit-input" placeholder="단위 (예: N/mm²)" value="${escapeHtml(it.unit || '')}" data-field="unit" />
        </div>`;
    } else if (groupKey === 'certifications') {
      fieldsHtml = `
        <div class="pe-fact-fields">
          <input class="pe-fact-label-input" placeholder="인증명" value="${escapeHtml(it.name || '')}" data-field="name" />
          <input class="pe-fact-value-input" placeholder="기관 (예: KTR)" value="${escapeHtml(it.agency || '')}" data-field="agency" />
        </div>`;
    } else {
      fieldsHtml = `<input class="pe-fact-text-input" placeholder="내용" value="${escapeHtml(it.text || '')}" data-field="text" />`;
    }

    row.innerHTML = `
      <input type="checkbox" class="pe-fact-check" ${it.approved ? 'checked' : ''} aria-label="채택" />
      <div class="pe-fact-body">
        ${fieldsHtml}
        <div class="pe-fact-source">
          ${it.source ? `<span class="pe-fact-source-tag">출처: ${escapeHtml(it.source)}</span>` : ''}
          ${conf != null ? `<span class="pe-fact-confidence ${confCls}">신뢰도 ${conf}%</span>` : ''}
        </div>
      </div>
      <button type="button" class="pe-fact-rm" aria-label="삭제">삭제</button>
    `;
    // 이벤트
    row.querySelector('.pe-fact-check').addEventListener('change', e => {
      it.approved = e.target.checked;
      row.classList.toggle('pe-fact-rejected', !it.approved);
      // 그룹 헤더 카운트 업데이트
      const head = row.parentElement.previousElementSibling;
      if (head) {
        const items = productEditorCtx.draft.masterFacts[groupKey] || [];
        const cnt = head.querySelector('.pe-facts-count');
        if (cnt) cnt.textContent = `${items.filter(x => x.approved).length} / ${items.length}`;
      }
    });
    row.querySelectorAll('input[data-field]').forEach(inp => {
      inp.addEventListener('input', e => { it[e.target.dataset.field] = e.target.value; });
    });
    row.querySelector('.pe-fact-rm').addEventListener('click', () => {
      const items = productEditorCtx.draft.masterFacts[groupKey] || [];
      const i = items.indexOf(it);
      if (i >= 0) items.splice(i, 1);
      renderProductFacts();
    });
    return row;
  }
  function renderSubstrateGroup() {
    const f = productEditorCtx.draft.masterFacts;
    const items = f.compatibleSubstrates || [];
    const wrap = document.createElement('div');
    wrap.className = 'pe-facts-group';
    const head = document.createElement('div');
    head.className = 'pe-facts-group-head';
    head.innerHTML = `<span>적용 가능 기재 (Substrates) — 자식 상품 분기의 핵심 <span class="pe-facts-count">${items.filter(x=>x.approved).length} / ${items.length}</span></span>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'pe-facts-group-add'; addBtn.textContent = '+ 추가';
    addBtn.addEventListener('click', () => {
      const name = prompt('기재명 (예: 목재, 철재, 벽돌, 콘크리트)');
      if (!name || !name.trim()) return;
      f.compatibleSubstrates = items;
      items.push({ id: newFactId('sub'), name: name.trim(), source: '직접 추가', approved: true });
      renderProductFacts();
    });
    head.appendChild(addBtn);
    wrap.appendChild(head);
    const body = document.createElement('div');
    body.className = 'pe-facts-group-body';
    const chipRow = document.createElement('div');
    chipRow.className = 'pe-substrate-row';
    if (!items.length) {
      const empty = document.createElement('span');
      empty.style.cssText = 'font-size:12px; color:var(--muted);'; empty.textContent = '없음 — 추출하거나 직접 추가';
      chipRow.appendChild(empty);
    }
    items.forEach((it, idx) => {
      const chip = document.createElement('span');
      chip.className = 'pe-chip' + (it.approved ? '' : ' pe-chip-rejected');
      chip.innerHTML = `<span>${escapeHtml(it.name)}</span><button type="button" class="pe-chip-rm" aria-label="삭제">×</button>`;
      chip.addEventListener('click', e => {
        if (e.target.classList.contains('pe-chip-rm')) return;
        it.approved = !it.approved;
        chip.classList.toggle('pe-chip-rejected', !it.approved);
        const cnt = head.querySelector('.pe-facts-count');
        if (cnt) cnt.textContent = `${items.filter(x=>x.approved).length} / ${items.length}`;
      });
      chip.querySelector('.pe-chip-rm').addEventListener('click', ev => {
        ev.stopPropagation();
        const i = items.indexOf(it);
        if (i >= 0) items.splice(i, 1);
        renderProductFacts();
      });
      chipRow.appendChild(chip);
    });
    body.appendChild(chipRow);
    wrap.appendChild(body);
    return wrap;
  }

  function renderProductSharedImages() {
    const ctx = productEditorCtx;
    if (!ctx) return;
    document.querySelectorAll('#peSharedList .pe-shared-row').forEach(row => {
      const key = row.dataset.key;
      const cur = (ctx.draft.sharedImages && ctx.draft.sharedImages[key]) || {};
      row.querySelector('[data-shared-url]').value = cur.url || '';
      row.querySelector('[data-shared-caption]').value = cur.caption || '';
      const prev = row.querySelector('[data-shared-preview]');
      if (cur.url) {
        prev.innerHTML = `<img src="${escapeHtml(cur.url)}" alt="" onerror="this.parentElement.innerHTML='<span class=\\'pe-shared-preview-empty\\'>로드 실패</span>'" />`;
      } else {
        prev.innerHTML = '<span class="pe-shared-preview-empty">미리보기</span>';
      }
    });
  }
  function bindProductSharedImageInputs() {
    document.querySelectorAll('#peSharedList .pe-shared-row').forEach(row => {
      const key = row.dataset.key;
      const urlInp = row.querySelector('[data-shared-url]');
      const capInp = row.querySelector('[data-shared-caption]');
      const onChange = () => {
        if (!productEditorCtx) return;
        const url = urlInp.value.trim(); const caption = capInp.value.trim();
        if (!productEditorCtx.draft.sharedImages) productEditorCtx.draft.sharedImages = {};
        productEditorCtx.draft.sharedImages[key] = url ? { url, caption } : null;
        const prev = row.querySelector('[data-shared-preview]');
        if (url) prev.innerHTML = `<img src="${escapeHtml(url)}" alt="" onerror="this.parentElement.innerHTML='<span class=\\'pe-shared-preview-empty\\'>로드 실패</span>'" />`;
        else prev.innerHTML = '<span class="pe-shared-preview-empty">미리보기</span>';
      };
      urlInp.addEventListener('change', onChange);
      capInp.addEventListener('change', onChange);
    });
  }

  function updateProductApproveButton() {
    const ctx = productEditorCtx;
    if (!ctx) return;
    const total = countTotalFacts(ctx.draft.masterFacts);
    const btn = document.getElementById('peApproveFacts');
    const badge = document.getElementById('peFactsApprovedBadge');
    if (ctx.draft.factsApproved) {
      btn.style.display = ''; btn.textContent = '↺ 검수 해제';
      badge.style.display = '';
    } else if (total > 0) {
      btn.style.display = ''; btn.textContent = '✓ 사실 확정';
      badge.style.display = 'none';
    } else {
      btn.style.display = 'none';
      badge.style.display = 'none';
    }
  }

  // -------- 사실 추출 (Claude) --------
  function buildProductFactsSystem() {
    return [
      '당신은 한국어 건축자재 제품 자료 분석 전문가입니다.',
      '사용자가 올린 우리 제품 자료(PDF·텍스트)에서 객관적 사실만 구조화하여 추출하세요.',
      '',
      '【엄격 규칙】',
      '1. 자료에 명시되지 않은 사실은 절대 만들어내지 마세요. 없으면 그 항목을 응답에서 빼면 됩니다.',
      '2. 수치는 단위까지 정확하게 분리하세요 (예: "5.8 N/mm²" → value="5.8", unit="N/mm²").',
      '3. 동일 정보가 여러 자료에 나오면 가장 권위 있는 출처(공인시험기관 > 카탈로그 > 메모)를 source로 지정.',
      '4. 광고 톤 표현("최고", "유일")은 그대로 옮기지 말고 측정 가능한 사실로 변환하거나 제외.',
      '5. compatibleSubstrates는 자식 상품 분기의 핵심 — 자료에서 "OO에 사용 가능"으로 명시된 모든 기재(목재·철재·벽돌·콘크리트·벽체 등)를 빠짐없이 추출.',
      '',
      '【출력 JSON 스키마】 — 이 형태로만 응답. JSON 외 어떤 텍스트도 포함 금지. ```json 코드펜스 사용 금지.',
      '{',
      '  "productName": "<자료에서 확인된 제품명>",',
      '  "keySpecs":     [{"label":"인장강도","value":"5.8","unit":"N/mm²","source":"카탈로그 p.2 / KTR 시험","kind":"tested","confidence":0.95}],',
      '  "sellingPoints":[{"text":"타사 대비 인장강도 4배","source":"카탈로그 p.3","confidence":0.9}],',
      '  "composition":  [{"text":"니들펀칭 섬유 + 도막방수재 일체화","source":"시방서 p.5","confidence":0.85}],',
      '  "certifications":[{"name":"공인시험","agency":"KTR","source":"성적서","confidence":1.0}],',
      '  "compatibleSubstrates":[{"name":"목재","source":"카탈로그 p.4"},{"name":"철재","source":"카탈로그 p.4"}],',
      '  "targetUses":   [{"text":"옥상 방수","source":"카탈로그 p.1","confidence":0.95}],',
      '  "cautions":     [{"text":"습윤 상태에서는 시공 금지","source":"시방서 p.7","confidence":0.9}],',
      '  "summary": "<1~2문장 분석 요약>"',
      '}',
      '',
      'kind: tested(공인시험 결과) | declared(자체 발표 수치) | unknown',
      'confidence: 0~1, 자료에서 명확하면 0.9+, 추론이면 0.5~0.8',
    ].join('\n');
  }
  function buildProductFactsUserContent(pdfs, ownText) {
    const blocks = [];
    pdfs.forEach((p, i) => {
      blocks.push({ type: 'text', text: `【제품 자료 PDF #${i + 1}】 파일명: ${p.name}` });
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: p.base64 },
        cache_control: { type: 'ephemeral' },
      });
    });
    if (ownText && ownText.trim()) {
      blocks.push({ type: 'text', text: '【제품 자료 텍스트】\n\n' + ownText.trim() });
    }
    blocks.push({ type: 'text', text: '위 자료에서 객관적 사실을 위 JSON 스키마로만 응답하세요. 자료에 없는 사실은 절대 만들지 마세요.' });
    return blocks;
  }
  async function runProductFactsExtraction() {
    const ctx = productEditorCtx;
    if (!ctx) return;
    await loadClaudeProxyConfig();
    if (!claudeProxyConfig || !claudeProxyConfig.workerUrl || !claudeProxyConfig.workerSecret || !claudeProxyConfig.claudeApiKey) {
      toast('⚙ Claude 자동채우기 설정에서 워커 URL · 시크릿 · API 키를 먼저 입력하세요.', 'error');
      return;
    }
    const ownText = document.getElementById('peOwnText').value;
    const hasInput = ctx.sourcePdfs.length > 0 || (ownText && ownText.trim().length > 0);
    if (!hasInput) {
      toast('자료 (PDF 또는 텍스트)를 1개 이상 추가하세요.', 'error');
      return;
    }
    const status = document.getElementById('peExtractStatus');
    const btn = document.getElementById('peExtract');
    btn.disabled = true;
    status.className = 'pe-extract-status running';
    status.textContent = '🤖 Claude 분석 중... (PDF 1MB당 약 20초)';
    try {
      const system = buildProductFactsSystem();
      const content = buildProductFactsUserContent(ctx.sourcePdfs, ownText);
      const r = await fetch(claudeProxyConfig.workerUrl.replace(/\/$/, ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': claudeProxyConfig.workerSecret },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          system, messages: [{ role: 'user', content }],
          claudeApiKey: claudeProxyConfig.claudeApiKey,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const json = extractClaudeJson(data);
      mergeProductFacts(ctx.draft.masterFacts, json);
      // sourcePdfMeta 업데이트 (이번에 분석된 자료를 제품에 영구 기록)
      ctx.sourcePdfs.forEach(p => {
        if (!ctx.draft.sourcePdfMeta.some(m => m.name === p.name && m.size === p.size)) {
          ctx.draft.sourcePdfMeta.push({ name: p.name, size: p.size, uploadedAt: nowIso() });
        }
      });
      ctx.draft.factsExtractedAt = nowIso();
      ctx.draft.factsApproved = false; // 새로 추출했으므로 재검수 필요
      // 제품명 기본 채우기
      if (json.productName && !ctx.draft.name) {
        ctx.draft.name = json.productName;
        document.getElementById('peName').value = ctx.draft.name;
      }
      const usage = data.usage || {};
      const tokenInfo = usage.input_tokens
        ? ` · 입력 ${usage.input_tokens} / 출력 ${usage.output_tokens}`
        : '';
      status.className = 'pe-extract-status ok';
      const total = countTotalFacts(ctx.draft.masterFacts);
      status.textContent = `✅ 추출 완료 — ${total}개 사실${tokenInfo}${json.summary ? ' · ' + json.summary : ''}`;
      renderProductFacts();
      updateProductApproveButton();
    } catch (e) {
      console.error('[products] 사실 추출 실패:', e);
      status.className = 'pe-extract-status error';
      status.textContent = '❌ 추출 실패: ' + (e.message || '알 수 없는 오류');
    } finally {
      btn.disabled = false;
    }
  }
  function mergeProductFacts(facts, extracted) {
    if (!extracted) return;
    const ensureId = (it, prefix) => { if (!it.id) it.id = newFactId(prefix); if (it.approved === undefined) it.approved = true; return it; };
    const merge = (key, items, prefix) => {
      if (!Array.isArray(items)) return;
      facts[key] = facts[key] || [];
      items.forEach(it => {
        ensureId(it, prefix);
        // 중복 검사 (label/text/name 기준)
        const matchKey = it.label || it.text || it.name;
        const dup = facts[key].find(x => (x.label || x.text || x.name) === matchKey);
        if (!dup) facts[key].push(it);
        else Object.assign(dup, it, { id: dup.id }); // 기존 항목 갱신, id는 보존
      });
    };
    merge('keySpecs', extracted.keySpecs, 'spec');
    merge('sellingPoints', extracted.sellingPoints, 'sp');
    merge('composition', extracted.composition, 'cp');
    merge('certifications', extracted.certifications, 'cert');
    merge('compatibleSubstrates', extracted.compatibleSubstrates, 'sub');
    merge('targetUses', extracted.targetUses, 'use');
    merge('cautions', extracted.cautions, 'caution');
  }

  // -------- 제품 편집기 — 저장/검수/취소 --------
  async function saveProductEditor() {
    const ctx = productEditorCtx;
    if (!ctx) return;
    const code = document.getElementById('peCode').value.trim();
    const name = document.getElementById('peName').value.trim();
    if (!code) { toast('제품 코드를 입력하세요', 'error'); switchProductTab('basic'); return; }
    if (!name) { toast('제품명을 입력하세요', 'error'); switchProductTab('basic'); return; }
    ctx.draft.productCode = code;
    ctx.draft.name = name;
    ctx.draft.description = document.getElementById('peDesc').value.trim();
    // 텍스트 자료 (단일 슬롯)
    const ownText = document.getElementById('peOwnText').value.trim();
    if (!ctx.draft.sources) ctx.draft.sources = { pdfs: [], texts: [] };
    ctx.draft.sources.texts = ownText ? [{ label: 'memo', text: ownText, addedAt: nowIso() }] : [];
    // 공유 이미지는 input change 이벤트로 이미 draft에 반영됨
    const ok = await saveProduct(ctx.draft);
    if (ok) {
      closeModal('productEditor');
      productEditorCtx = null;
      renderProductList();
      toast('제품 저장됨', 'success');
      if (document.body.getAttribute('data-mode') === 'product') refreshProductDashboard();
    }
  }
  async function approveProductFacts() {
    const ctx = productEditorCtx;
    if (!ctx) return;
    if (ctx.draft.factsApproved) {
      ctx.draft.factsApproved = false;
      ctx.draft.factsApprovedAt = null;
      toast('검수 해제됨 — 재검수 필요', 'info');
    } else {
      const total = countTotalFacts(ctx.draft.masterFacts);
      const approved = countApprovedFacts(ctx.draft.masterFacts);
      if (!confirm(`사실 ${approved}/${total}개를 채택 상태로 확정합니다.\n확정 후에도 다시 편집·재추출 가능합니다.\n진행할까요?`)) return;
      ctx.draft.factsApproved = true;
      ctx.draft.factsApprovedAt = nowIso();
      const me = getMeStaff();
      ctx.draft.factsApprovedBy = me ? me.name : '익명';
      toast('✓ 사실 확정 — 자식 상품 단계에서 재활용 가능', 'success');
    }
    updateProductApproveButton();
  }

  // -------- 와이어업 --------
  function wireProductEditor() {
    // 탭 전환
    document.querySelectorAll('#productEditor .pe-tab').forEach(b => {
      b.addEventListener('click', () => switchProductTab(b.dataset.tab));
    });
    // 자료 드롭
    const drop = document.getElementById('peOwnDrop');
    const fileInput = document.getElementById('peOwnFile');
    const pickBtn = document.getElementById('peOwnPick');
    const open = () => fileInput.click();
    drop.addEventListener('click', e => { if (e.target !== pickBtn) open(); });
    pickBtn.addEventListener('click', e => { e.stopPropagation(); open(); });
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }});
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', async e => {
      e.preventDefault(); drop.classList.remove('dragover');
      const files = (e.dataTransfer && e.dataTransfer.files) || [];
      for (const f of files) await addProductPdf(f);
    });
    fileInput.addEventListener('change', async e => {
      const files = e.target.files || [];
      for (const f of files) await addProductPdf(f);
      e.target.value = '';
    });
    // 사실 추출
    document.getElementById('peExtract').addEventListener('click', runProductFactsExtraction);
    document.getElementById('peApproveFacts').addEventListener('click', approveProductFacts);
    // 공유 이미지 입력
    bindProductSharedImageInputs();
    // 닫기/저장/삭제
    document.getElementById('peClose').addEventListener('click', () => { closeModal('productEditor'); productEditorCtx = null; });
    document.getElementById('peCancel').addEventListener('click', () => { closeModal('productEditor'); productEditorCtx = null; });
    document.getElementById('peSave').addEventListener('click', saveProductEditor);
    document.getElementById('peDelete').addEventListener('click', async () => {
      if (productEditorCtx && productEditorCtx.mode === 'edit') {
        await deleteProduct(productEditorCtx.draft.id);
        if (!productsCache.find(p => p.id === productEditorCtx.draft.id)) {
          closeModal('productEditor');
          productEditorCtx = null;
        }
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 🏷 상품 (Listings) — Stage 1 + Stage 2 + Stage 3 (디자인만)
  // ════════════════════════════════════════════════════════════════
  // 1제품(POUR코트재) → N상품(목재페인트·철재페인트…) — 카페24 등록 단위.
  // 가격·SKU·재고는 카페24 영역 — 여기는 디자인만 다룸.
  const LISTINGS_COLLECTION = 'pourstore-renewal-listings';
  let listingsCache = [];
  let listingEditorCtx = null;

  // ── vibe 프리셋 5종 — 통디자인 시스템
  const VIBE_PRESETS = [
    {
      id: 'warm-natural', emoji: '🟫', name: '따뜻·자연',
      target: '목재·우드·데크',
      primaryColor: '#8B5A3C', secondaryColor: '#FFF8E7', accentColor: '#D9A876',
      bgColor: '#FAF7F2', fontMood: 'rounded',
      imageStyle: 'natural light, warm tones, organic textures, soft shadows',
      visualKeywords: ['우드', '따뜻함', '자연', '나무결'],
    },
    {
      id: 'cool-tech', emoji: '⚫', name: '차가움·견고',
      target: '철재·금속·산업',
      primaryColor: '#1E3A5F', secondaryColor: '#F4F6F8', accentColor: '#6B7280',
      bgColor: '#F4F6F8', fontMood: 'tight',
      imageStyle: 'studio lighting, cool tones, sharp edges, industrial feel',
      visualKeywords: ['메탈', '견고', '산업', '정밀'],
    },
    {
      id: 'clean-bright', emoji: '⚪', name: '깔끔·밝음',
      target: '실내·벽체·일반',
      primaryColor: '#10B981', secondaryColor: '#FFFFFF', accentColor: '#A7F3D0',
      bgColor: '#FFFFFF', fontMood: 'clean',
      imageStyle: 'bright daylight, white background, minimalist, fresh',
      visualKeywords: ['깔끔', '밝음', '청결', '실내'],
    },
    {
      id: 'bold-industrial', emoji: '🔶', name: '강함·임팩트',
      target: '외장·공업·콘크리트',
      primaryColor: '#EA580C', secondaryColor: '#1F2937', accentColor: '#FBBF24',
      bgColor: '#1F2937', fontMood: 'bold',
      imageStyle: 'dramatic lighting, high contrast, urban concrete, raw textures',
      visualKeywords: ['강함', '임팩트', '도시', '거침'],
    },
    {
      id: 'earth-rough', emoji: '🟧', name: '자연·거침',
      target: '벽돌·외벽·자연석',
      primaryColor: '#B8593A', secondaryColor: '#F5E9DC', accentColor: '#7C5A4A',
      bgColor: '#F8F1E9', fontMood: 'serif',
      imageStyle: 'golden hour light, terracotta tones, weathered surfaces, earthy',
      visualKeywords: ['벽돌', '외벽', '자연석', '거침'],
    },
  ];
  function findVibe(id) { return VIBE_PRESETS.find(v => v.id === id) || VIBE_PRESETS[0]; }

  // ── 모드 토글 (페이지 / 상품)
  function setAppMode(mode) {
    if (mode !== 'page' && mode !== 'product') mode = 'page';
    document.body.setAttribute('data-mode', mode);
    try { localStorage.setItem('pourstore-app-mode', mode); } catch (_) {}
    document.querySelectorAll('.mode-tab').forEach(t => {
      const active = t.dataset.mode === mode;
      t.classList.toggle('mode-tab-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (mode === 'product') {
      refreshProductDashboard();
      maybeShowGuideOnce();
    }
  }
  function loadAppMode() {
    let saved = 'page';
    try { saved = localStorage.getItem('pourstore-app-mode') || 'page'; } catch (_) {}
    setAppMode(saved);
    // 처음 상품 모드 진입 시 가이드 한 번 자동 표시
    if (saved === 'product') maybeShowGuideOnce();
  }
  function openGuideModal() {
    const never = (() => { try { return localStorage.getItem('pourstore-guide-never') === '1'; } catch (_) { return false; } })();
    const cb = document.getElementById('gdNeverShow');
    if (cb) cb.checked = never;
    openModal('guideModal');
  }
  function maybeShowGuideOnce() {
    let seen = '0', never = '0';
    try {
      seen = localStorage.getItem('pourstore-guide-seen') || '0';
      never = localStorage.getItem('pourstore-guide-never') || '0';
    } catch (_) {}
    if (seen === '0' && never === '0') {
      // 다른 모달이 닫힌 후에 표시
      setTimeout(() => openGuideModal(), 400);
    }
  }

  // ── 상품 대시보드 — 단계별 가이드
  async function refreshProductDashboard() {
    // 1) 카운트 즉시 표시 (캐시)
    updateDashCounts();
    // 2) 캐시 비어있으면 로드 후 다시 갱신
    const loads = [];
    if (!productsCache.length) loads.push(loadProducts());
    if (!listingsCache.length) loads.push(loadListings());
    if (!instancesCache.length) loads.push(loadInstances());
    if (loads.length) {
      await Promise.all(loads);
      updateDashCounts();
    }
    renderOnboardChecklist();
    renderDashRecent();
  }
  function updateDashCounts() {
    const products = productsCache.length;
    const listings = listingsCache.length;
    const instances = instancesCache.length;
    // 완성된 상세페이지 = 슬롯 1개 이상 채워진 인스턴스
    const filled = instancesCache.filter(i => Object.keys(i.slots || {}).length > 0).length;
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('dashCntProducts', products);
    setEl('dashCntListings', listings);
    setEl('dashCntInstances', instances);
    setEl('dashCntFilled', filled);
  }
  function computeOnboarding() {
    const claudeOk = !!(claudeProxyConfig && claudeProxyConfig.workerUrl && claudeProxyConfig.workerSecret && claudeProxyConfig.claudeApiKey);
    const tplOk = (state.templates || []).length > 0;
    const productOk = productsCache.length > 0;
    const factsOk = productsCache.some(p => p.factsApproved);
    const manusOk = !!(manusConfig && manusConfig.workerUrl && manusConfig.workerSecret);
    return [
      {
        key: 'claude', icon: '🤖', name: 'Claude API 키 설정',
        desc: '사실 추출·카피 생성·AI 분기 제안에 필요. 워커 URL + WORKER_SECRET + Anthropic API 키 (sk-ant-...)',
        done: claudeOk, optional: false,
        cta: claudeOk ? '재설정' : '지금 설정', action: () => openClaudeConfigModal(),
      },
      {
        key: 'tpl', icon: '📐', name: 'POUR 기본 템플릿 불러오기',
        desc: '14섹션 상세페이지 뼈대 (98개 슬롯). 한 번 등록하면 모든 상품에서 재사용.',
        done: tplOk, optional: false,
        cta: tplOk ? `보유 ${(state.templates || []).length}개` : '템플릿 불러오기', action: () => openTemplatesModal(),
      },
      {
        key: 'product', icon: '📦', name: '첫 마스터 제품 등록',
        desc: 'POUR코트재처럼 자식 상품들의 부모가 될 모제품. 기본정보 + PDF 자료까지 입력.',
        done: productOk, optional: false,
        cta: productOk ? `보유 ${productsCache.length}개` : '+ 첫 제품', action: () => openProductEditor(null),
      },
      {
        key: 'facts', icon: '✓', name: '사실 카드 추출 + 검수',
        desc: '제품 편집기 ③ 사실 카드 탭에서 자료 분석 → 검수 → 확정. 자식 상품 분기의 토대.',
        done: factsOk, optional: false,
        cta: factsOk ? '검수 완료' : (productOk ? '검수 진행' : '먼저 제품 등록'),
        action: () => {
          const pending = productsCache.find(p => !p.factsApproved);
          if (pending) openProductEditor(pending.id);
          else if (productsCache.length) openProductEditor(productsCache[0].id);
          else openProductEditor(null);
        },
      },
      {
        key: 'manus', icon: '🚀', name: '마누스 워커 설정',
        desc: '이미지 자동 생성용. 텍스트 카피만 쓸 거면 건너뛰어도 됩니다.',
        done: manusOk, optional: true,
        cta: manusOk ? '재설정' : '나중에 설정', action: () => openManusConfigModal(),
      },
    ];
  }
  function renderOnboardChecklist() {
    const wrap = document.getElementById('dashChecklist');
    if (!wrap) return;
    const items = computeOnboarding();
    const required = items.filter(it => !it.optional);
    const doneRequired = required.filter(it => it.done).length;
    const total = required.length;
    // 첫 미완료 (필수만) — 현재 단계 표시
    const currentKey = (required.find(it => !it.done) || {}).key;
    wrap.innerHTML = '';
    items.forEach((it, idx) => {
      const row = document.createElement('div');
      const isCurrent = it.key === currentKey;
      row.className = 'dash-check-item' + (it.done ? ' dash-check-done' : '') + (isCurrent ? ' dash-check-current' : '');
      row.innerHTML = `
        <div class="dash-check-icon">${it.done ? '✓' : (idx + 1)}</div>
        <div class="dash-check-body">
          <div class="dash-check-name">${escapeHtml(it.name)}${it.optional ? '<span class="dash-check-optional">선택</span>' : ''}</div>
          <div class="dash-check-desc">${escapeHtml(it.desc)}</div>
        </div>
        <button class="btn ${it.done ? 'btn-ghost' : 'btn-primary'} btn-sm dash-check-btn">${escapeHtml(it.cta)}</button>
      `;
      row.querySelector('.dash-check-btn').addEventListener('click', () => it.action());
      wrap.appendChild(row);
    });
    // 진행도 바 갱신
    const fill = document.getElementById('dashProgFill');
    const done = document.getElementById('dashProgDone');
    const totalEl = document.getElementById('dashProgTotal');
    const tagEl = document.getElementById('dashOnboardTag');
    const wrap2 = document.getElementById('dashProgressWrap');
    const onb = document.getElementById('dashOnboard');
    if (fill) fill.style.width = (doneRequired / total * 100) + '%';
    if (done) done.textContent = doneRequired;
    if (totalEl) totalEl.textContent = total;
    if (wrap2) wrap2.classList.toggle('dash-progress-complete', doneRequired === total);
    if (tagEl) {
      if (doneRequired === total) {
        tagEl.textContent = '완료'; tagEl.className = 'dash-section-tag dash-section-tag-done';
      } else {
        tagEl.textContent = `${doneRequired}/${total} 진행 중`; tagEl.className = 'dash-section-tag';
      }
    }
    // 완료 시 자동 접기 (사용자가 다시 펼칠 수 있음)
    if (onb && doneRequired === total && !onb.dataset.userOpened) onb.open = false;
  }
  function renderDashRecent() {
    const wrap = document.getElementById('dashRecentList');
    if (!wrap) return;
    const recents = [];
    productsCache.slice(0, 5).forEach(p => recents.push({ kind: 'product', name: p.name || p.productCode, when: p.updatedAt, id: p.id }));
    listingsCache.slice(0, 5).forEach(l => recents.push({ kind: 'listing', name: l.listingName, when: l.updatedAt, id: l.id }));
    instancesCache.slice(0, 5).forEach(i => recents.push({ kind: 'instance', name: i.name, when: i.updatedAt, id: i.id }));
    recents.sort((a, b) => (b.when || '').localeCompare(a.when || ''));
    if (!recents.length) {
      wrap.innerHTML = '<div class="dash-recent-empty">아직 작업 내역이 없습니다 — 상단 카드에서 시작하세요.</div>';
      return;
    }
    wrap.innerHTML = '';
    recents.slice(0, 8).forEach(r => {
      const el = document.createElement('div');
      el.className = 'dash-recent-item';
      const tagCls = r.kind === 'product' ? 'dash-recent-tag-product'
        : r.kind === 'listing' ? 'dash-recent-tag-listing' : 'dash-recent-tag-instance';
      const tagText = r.kind === 'product' ? '제품' : r.kind === 'listing' ? '상품' : '상세';
      el.innerHTML = `
        <span class="dash-recent-tag ${tagCls}">${tagText}</span>
        <span class="dash-recent-name">${escapeHtml(r.name || '(이름 없음)')}</span>
        <span class="dash-recent-when">${escapeHtml((r.when || '').slice(0, 16).replace('T', ' '))}</span>
      `;
      el.addEventListener('click', () => {
        if (r.kind === 'product') openProductEditor(r.id);
        else if (r.kind === 'listing') openListingEditor(r.id);
        else openInstanceEditor(r.id);
      });
      wrap.appendChild(el);
    });
  }

  // ── listings CRUD
  function newListing() {
    return {
      id: 'lst-' + Math.random().toString(36).slice(2, 10),
      productId: '',
      listingName: '',
      targetSubstrate: '',
      cafe24ProductNo: '',
      customSlogan: '',
      searchKeywords: [],
      colorOptions: [],
      emphasizedFactIds: [], // 마스터 facts에서 강조할 항목 id 목록
      vibe: 'warm-natural',
      customColors: { primary: '', secondary: '' },
      detailPageInstanceId: null,
      thumbnailImageUrl: '',
      createdAt: null, updatedAt: null, deleted: false,
    };
  }
  async function loadListings() {
    if (!firebaseReady || !db) { return []; }
    try {
      const snap = await db.collection(LISTINGS_COLLECTION).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => !l.deleted);
      docs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      listingsCache = docs;
      console.log(`[listings] ${docs.length}건 로드`);
      return docs;
    } catch (e) {
      console.error('[listings] 로드 실패:', e);
      toast('상품 목록 로드 실패: ' + (e.code || e.message || ''), 'error');
      return [];
    }
  }
  async function saveListing(lst) {
    if (!firebaseReady || !db) { toast('오프라인 — 저장 불가', 'error'); return false; }
    const me = getMeStaff();
    lst.updatedAt = nowIso();
    lst.updatedByName = me ? me.name : '익명';
    if (!lst.createdAt) {
      lst.createdAt = lst.updatedAt;
      lst.createdByName = me ? me.name : '익명';
    }
    try {
      await db.collection(LISTINGS_COLLECTION).doc(lst.id).set(lst, { merge: false });
      const idx = listingsCache.findIndex(l => l.id === lst.id);
      if (idx >= 0) listingsCache[idx] = lst; else listingsCache.unshift(lst);
      return true;
    } catch (e) {
      console.error('[listings] 저장 실패:', e);
      toast('저장 실패: ' + (e.code || e.message || ''), 'error');
      return false;
    }
  }
  async function deleteListing(id) {
    const lst = listingsCache.find(l => l.id === id);
    if (!lst) return;
    if (!confirm(`'${lst.listingName}' 상품을 삭제할까요?`)) return;
    try {
      await db.collection(LISTINGS_COLLECTION).doc(id).update({ deleted: true, deletedAt: nowIso() });
      listingsCache = listingsCache.filter(l => l.id !== id);
      renderListingList();
      toast('삭제됨', 'info');
    } catch (e) {
      console.error('[listings] 삭제 실패:', e);
      toast('삭제 실패: ' + (e.code || e.message || ''), 'error');
    }
  }

  // ── 상품 목록 모달
  async function openListingsModal() {
    document.getElementById('lstListWrap').innerHTML = '<div class="lst-empty">불러오는 중...</div>';
    openModal('listingsModal');
    if (!productsCache.length) await loadProducts();
    await loadListings();
    renderListingList();
  }
  function renderListingList() {
    const wrap = document.getElementById('lstListWrap');
    if (!listingsCache.length) {
      wrap.innerHTML = `<div class="lst-empty">아직 등록된 상품이 없습니다.<br/>오른쪽 위 <b>+ 새 상품</b> 또는 <b>🪄 분기 제안</b>으로 시작하세요.</div>`;
      return;
    }
    const list = document.createElement('div');
    list.className = 'lst-list';
    listingsCache.forEach(l => {
      const master = productsCache.find(p => p.id === l.productId);
      const vibe = findVibe(l.vibe);
      const card = document.createElement('div');
      card.className = 'lst-card';
      card.innerHTML = `
        <div class="lst-card-vibe" style="background:${vibe.bgColor}; border:1px solid ${vibe.primaryColor};">
          <span style="font-size:24px;">${vibe.emoji}</span>
        </div>
        <div class="lst-card-main">
          <div class="lst-card-title">
            ${escapeHtml(l.listingName || '(이름 없음)')}
            ${master ? `<span class="lst-card-master">📦 ${escapeHtml(master.name)}</span>` : '<span class="lst-card-master" style="color:#B91C1C;">⚠ 마스터 없음</span>'}
            ${l.cafe24ProductNo ? `<span class="lst-card-cafe24">카페24 #${escapeHtml(l.cafe24ProductNo)}</span>` : ''}
          </div>
          <div class="lst-card-substrate">${l.targetSubstrate ? `적용기재: ${escapeHtml(l.targetSubstrate)}` : ''}${l.customSlogan ? ` · ${escapeHtml(l.customSlogan)}` : ''}</div>
          <div class="lst-card-meta">
            <span>vibe: <b style="color:${vibe.primaryColor};">${escapeHtml(vibe.name)}</b></span>
            <span>강조 사실 <b>${(l.emphasizedFactIds || []).length}</b>개</span>
            <span>상세페이지 <b>${l.detailPageInstanceId ? '✓' : '–'}</b></span>
          </div>
        </div>
        <div class="lst-card-badges"></div>
      `;
      card.addEventListener('click', () => openListingEditor(l.id));
      list.appendChild(card);
    });
    wrap.innerHTML = '';
    wrap.appendChild(list);
  }

  // ── 상품 편집기
  async function openListingEditor(listingId) {
    if (!productsCache.length) await loadProducts();
    if (!listingsCache.length && listingId) await loadListings();
    if (!instancesCache.length) await loadInstances();
    const isNew = !listingId;
    const draft = isNew
      ? newListing()
      : JSON.parse(JSON.stringify(listingsCache.find(l => l.id === listingId) || newListing()));
    listingEditorCtx = { listingId: draft.id, draft, mode: isNew ? 'new' : 'edit' };
    document.getElementById('leTitle').textContent = isNew ? '+ 새 상품(Listing)' : `상품 편집: ${draft.listingName || ''}`;
    document.getElementById('leDelete').style.display = isNew ? 'none' : '';
    // 마스터 셀렉트 채우기
    const masterSel = document.getElementById('leMaster');
    masterSel.innerHTML = '<option value="">— 모제품 선택 —</option>';
    productsCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `📦 ${p.name || p.productCode}`;
      masterSel.appendChild(opt);
    });
    masterSel.value = draft.productId || '';
    onListingMasterChange(); // substrates 채움
    document.getElementById('leSubstrate').value = draft.targetSubstrate || '';
    document.getElementById('leName').value = draft.listingName || '';
    document.getElementById('leCafe24').value = draft.cafe24ProductNo || '';
    document.getElementById('leSlogan').value = draft.customSlogan || '';
    document.getElementById('leKeywords').value = (draft.searchKeywords || []).join(', ');
    document.getElementById('leColors').value = (draft.colorOptions || []).join(', ');
    renderListingEmphasized();
    renderListingVibeGrid();
    setListingVibe(draft.vibe || 'warm-natural', /*skipDirty*/true);
    document.getElementById('leCustomPrimary').value = draft.customColors && draft.customColors.primary ? draft.customColors.primary : findVibe(draft.vibe).primaryColor;
    document.getElementById('leCustomPrimaryText').value = draft.customColors && draft.customColors.primary ? draft.customColors.primary : '';
    renderListingDetailStatus();
    switchListingTab('basic');
    openModal('listingEditor');
  }
  function switchListingTab(tab) {
    document.querySelectorAll('#listingEditor .le-tab').forEach(b => b.classList.toggle('le-tab-active', b.dataset.tab === tab));
    ['basic','emphasized','vibe','output'].forEach(t => {
      const el = document.getElementById('leTab' + t.charAt(0).toUpperCase() + t.slice(1));
      if (el) el.style.display = (t === tab) ? '' : 'none';
    });
  }
  function onListingMasterChange() {
    const masterId = document.getElementById('leMaster').value;
    const master = productsCache.find(p => p.id === masterId);
    const sel = document.getElementById('leSubstrate');
    sel.innerHTML = '<option value="">— 적용 기재 (선택) —</option>';
    if (master && master.masterFacts && Array.isArray(master.masterFacts.compatibleSubstrates)) {
      master.masterFacts.compatibleSubstrates.filter(s => s.approved !== false).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name; opt.textContent = s.name;
        sel.appendChild(opt);
      });
    }
    if (listingEditorCtx) listingEditorCtx.draft.productId = masterId;
    renderListingEmphasized(); // 마스터 바뀌면 사실 목록도 갱신
  }
  function renderListingEmphasized() {
    const wrap = document.getElementById('leEmpBody');
    wrap.innerHTML = '';
    if (!listingEditorCtx) return;
    const master = productsCache.find(p => p.id === listingEditorCtx.draft.productId);
    if (!master || !master.masterFacts) {
      wrap.innerHTML = '<div class="le-emp-empty">먼저 ① 기본정보 탭에서 모제품(마스터)를 선택하세요.</div>';
      return;
    }
    const f = master.masterFacts;
    const groups = [
      ['keySpecs', '핵심 수치'],
      ['sellingPoints', '소구점'],
      ['targetUses', '용도'],
      ['certifications', '인증'],
      ['composition', '성분·구성'],
    ];
    const checked = new Set(listingEditorCtx.draft.emphasizedFactIds || []);
    groups.forEach(([key, title]) => {
      const items = (f[key] || []).filter(it => it.approved !== false);
      const grp = document.createElement('div');
      grp.className = 'le-emp-group';
      const head = document.createElement('div');
      head.className = 'le-emp-head';
      head.innerHTML = `<span>${escapeHtml(title)}</span><span class="le-emp-count">${items.filter(it => checked.has(it.id)).length} / ${items.length}</span>`;
      grp.appendChild(head);
      const body = document.createElement('div');
      body.className = 'le-emp-body';
      if (!items.length) {
        const emp = document.createElement('div');
        emp.className = 'le-emp-empty';
        emp.textContent = `없음 — 마스터에서 추출/추가 후 다시 열어주세요`;
        body.appendChild(emp);
      } else {
        items.forEach(it => {
          const row = document.createElement('label');
          row.className = 'le-emp-row' + (checked.has(it.id) ? ' le-emp-checked' : '');
          const text = key === 'keySpecs'
            ? `<b>${escapeHtml(it.label || '')}</b>: ${escapeHtml(it.value || '')} ${escapeHtml(it.unit || '')}`
            : key === 'certifications'
              ? `<b>${escapeHtml(it.name || '')}</b>${it.agency ? ` (${escapeHtml(it.agency)})` : ''}`
              : escapeHtml(it.text || '');
          row.innerHTML = `
            <input type="checkbox" ${checked.has(it.id) ? 'checked' : ''} />
            <div class="le-emp-text">${text}${it.source ? `<span class="le-emp-source">${escapeHtml(it.source)}</span>` : ''}</div>
          `;
          row.querySelector('input').addEventListener('change', e => {
            const ids = listingEditorCtx.draft.emphasizedFactIds || [];
            if (e.target.checked) { if (!ids.includes(it.id)) ids.push(it.id); }
            else { const i = ids.indexOf(it.id); if (i >= 0) ids.splice(i, 1); }
            listingEditorCtx.draft.emphasizedFactIds = ids;
            row.classList.toggle('le-emp-checked', e.target.checked);
            const cnt = head.querySelector('.le-emp-count');
            if (cnt) {
              const set = new Set(listingEditorCtx.draft.emphasizedFactIds || []);
              cnt.textContent = `${items.filter(x => set.has(x.id)).length} / ${items.length}`;
            }
          });
          body.appendChild(row);
        });
      }
      grp.appendChild(body);
      wrap.appendChild(grp);
    });
  }
  function renderListingVibeGrid() {
    const grid = document.getElementById('leVibeGrid');
    grid.innerHTML = '';
    VIBE_PRESETS.forEach(v => {
      const card = document.createElement('div');
      card.className = 'le-vibe-card';
      card.dataset.vibe = v.id;
      card.innerHTML = `
        <div class="le-vibe-swatches">
          <span class="le-vibe-swatch" style="background:${v.primaryColor};" title="primary"></span>
          <span class="le-vibe-swatch" style="background:${v.secondaryColor};" title="secondary"></span>
          <span class="le-vibe-swatch" style="background:${v.accentColor};" title="accent"></span>
        </div>
        <div class="le-vibe-name">${v.emoji} ${escapeHtml(v.name)}</div>
        <div class="le-vibe-target">${escapeHtml(v.target)}</div>
        <div class="le-vibe-keywords">${v.visualKeywords.map(k => `<span>${escapeHtml(k)}</span>`).join('')}</div>
      `;
      card.addEventListener('click', () => setListingVibe(v.id));
      grid.appendChild(card);
    });
  }
  function setListingVibe(id, skipDirty) {
    if (!listingEditorCtx) return;
    listingEditorCtx.draft.vibe = id;
    document.querySelectorAll('#leVibeGrid .le-vibe-card').forEach(c => {
      c.classList.toggle('le-vibe-active', c.dataset.vibe === id);
    });
    const v = findVibe(id);
    if (!skipDirty) {
      // 사용자가 클릭한 경우 — 미세조정 컬러 리셋
      listingEditorCtx.draft.customColors = { primary: '', secondary: '' };
      document.getElementById('leCustomPrimary').value = v.primaryColor;
      document.getElementById('leCustomPrimaryText').value = '';
    }
  }
  function renderListingDetailStatus() {
    const ctx = listingEditorCtx; if (!ctx) return;
    // 템플릿 셀렉트
    const tplSel = document.getElementById('leDetailTemplate');
    tplSel.innerHTML = '<option value="">— 템플릿 선택 —</option>';
    (state.templates || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = `📐 ${t.name} (슬롯 ${(t.slots || []).length})`;
      tplSel.appendChild(opt);
    });
    // 상태 표시
    const status = document.getElementById('leDetailStatus');
    const openBtn = document.getElementById('leOpenDetail');
    if (ctx.draft.detailPageInstanceId) {
      const inst = instancesCache.find(i => i.id === ctx.draft.detailPageInstanceId);
      if (inst) {
        const filled = Object.keys(inst.slots || {}).length;
        const tpl = (state.templates || []).find(t => t.id === inst.templateId);
        const total = tpl ? (tpl.slots || []).length : 0;
        status.innerHTML = `✓ 연결됨 — <b>${escapeHtml(inst.name)}</b> · ${filled}/${total} 슬롯 채움`;
        openBtn.style.display = '';
        openBtn.onclick = () => { closeModal('listingEditor'); listingEditorCtx = null; openInstanceEditor(inst.id); };
        return;
      }
    }
    status.textContent = '아직 생성된 상세페이지가 없습니다. 템플릿을 선택하고 자동 생성 버튼을 눌러주세요.';
    openBtn.style.display = 'none';
  }

  // ── 상품 → 상세페이지 자동 생성 (마스터 facts + 강조 + vibe → 슬롯 카피)
  async function generateDetailFromListing() {
    const ctx = listingEditorCtx; if (!ctx) return;
    const tplId = document.getElementById('leDetailTemplate').value;
    if (!tplId) { toast('템플릿을 선택하세요', 'error'); return; }
    const tpl = (state.templates || []).find(t => t.id === tplId);
    if (!tpl || !(tpl.slots || []).length) { toast('템플릿이 비어있습니다', 'error'); return; }
    const master = productsCache.find(p => p.id === ctx.draft.productId);
    if (!master) { toast('마스터 제품을 선택하세요', 'error'); switchListingTab('basic'); return; }
    if (!master.masterFacts || countTotalFacts(master.masterFacts) === 0) {
      toast('마스터 제품의 사실 카드가 비어있습니다 — 먼저 제품 편집기에서 사실 추출을 진행하세요', 'error'); return;
    }
    await loadClaudeProxyConfig();
    if (!claudeProxyConfig || !claudeProxyConfig.workerUrl || !claudeProxyConfig.workerSecret || !claudeProxyConfig.claudeApiKey) {
      toast('⚙ Claude 자동채우기 설정이 필요합니다 (페이지 모드에서 설정)', 'error');
      return;
    }
    const status = document.getElementById('leDetailGenStatus');
    const btn = document.getElementById('leGenerateDetail');
    btn.disabled = true;
    status.style.color = '#1E40AF';
    status.textContent = '🤖 마스터 사실 + 강조 + vibe로 슬롯 카피 생성 중... (1~2분)';
    try {
      // facts 텍스트화
      const factsText = serializeFactsForListing(master, ctx.draft);
      const vibe = findVibe(ctx.draft.vibe);
      const sysPrompt = [
        '당신은 한국어 제품 상세페이지 슬롯 카피 작성 전문가입니다.',
        '제공된 마스터 사실 + 강조 사실 + 통디자인(vibe)을 종합해 슬롯에 들어갈 카피를 작성하세요.',
        '',
        '【엄격 규칙】',
        '1. 마스터 사실에 없는 수치·주장은 절대 만들지 마세요. 없으면 value=null.',
        '2. 강조 사실은 헤드라인·소구점에 우선 배치.',
        `3. 통디자인 톤: ${vibe.name} (${vibe.target}) — 키워드 ${vibe.visualKeywords.join(', ')}. 카피 톤이 이 분위기와 일관되어야 함.`,
        '4. 슬롯 type에 맞게 작성 (text=한 줄, textarea=2~5문장, link=URL, image=이미지URL).',
        '5. 이미지 슬롯은 자료에서 URL을 추출 못 하면 value=null (직접 채울 수 있도록).',
        '',
        '【출력 JSON 스키마】 — JSON 외 텍스트 금지. 코드펜스 금지.',
        '{ "slots": { "<slotKey>": { "value": "<문자열 또는 null>", "kind": "fact|crafted|none", "reasoning": "<짧은 근거>" } }, "summary": "<1~2문장>" }',
      ].join('\n');
      const userText = [
        `【모제품】 ${master.name}`,
        `【상품】 ${ctx.draft.listingName} — 적용기재: ${ctx.draft.targetSubstrate || '미지정'}`,
        ctx.draft.customSlogan ? `【슬로건】 ${ctx.draft.customSlogan}` : '',
        `【통디자인 vibe】 ${vibe.emoji} ${vibe.name} — ${vibe.target}`,
        `【비주얼 키워드】 ${vibe.visualKeywords.join(', ')}`,
        '',
        '【슬롯 정의】',
        JSON.stringify((tpl.slots || []).map(s => ({ key: s.key, type: s.type, label: s.label || s.key })), null, 2),
        '',
        '【마스터 사실 + 강조 표시】',
        factsText,
        '',
        '위 정보로 모든 슬롯에 카피를 작성해 JSON으로만 응답하세요. 강조(★) 표시된 사실을 헤드라인·소구점에 우선 배치하세요.',
      ].filter(Boolean).join('\n');
      const r = await fetch(claudeProxyConfig.workerUrl.replace(/\/$/, ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': claudeProxyConfig.workerSecret },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 16384,
          system: sysPrompt,
          messages: [{ role: 'user', content: userText }],
          claudeApiKey: claudeProxyConfig.claudeApiKey,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const json = extractClaudeJson(data);
      const slotsObj = json.slots || {};
      const filledSlots = {};
      (tpl.slots || []).forEach(s => {
        const v = slotsObj[s.key];
        if (v && v.value !== null && v.value !== undefined && String(v.value).trim() !== '') {
          filledSlots[s.key] = String(v.value);
        }
      });
      // 공유 이미지 자동 주입 (옵션 A — 마스터에서 참조)
      if (master.sharedImages) {
        const map = { cert_image: 'cert', dataChart: 'dataChart', patent: 'patent' };
        Object.keys(map).forEach(slotKey => {
          const sharedKey = map[slotKey];
          if (master.sharedImages[sharedKey] && master.sharedImages[sharedKey].url
              && (tpl.slots || []).some(s => s.key === slotKey)
              && !filledSlots[slotKey]) {
            filledSlots[slotKey] = master.sharedImages[sharedKey].url;
          }
        });
      }
      // 인스턴스 생성
      const newInst = {
        id: 'inst-' + Math.random().toString(36).slice(2, 10),
        templateId: tpl.id,
        name: ctx.draft.listingName + ' — 상세페이지',
        slots: filledSlots,
        sourceListingId: ctx.draft.id,
        sourceMasterProductId: master.id,
        vibe: ctx.draft.vibe,
      };
      const ok = await saveInstance(newInst);
      if (!ok) throw new Error('인스턴스 저장 실패');
      ctx.draft.detailPageInstanceId = newInst.id;
      const usage = data.usage || {};
      const tokenInfo = usage.input_tokens ? ` · 토큰 ${usage.input_tokens}/${usage.output_tokens}` : '';
      status.style.color = '#059669';
      status.textContent = `✅ 생성 완료 — ${Object.keys(filledSlots).length}/${(tpl.slots || []).length} 슬롯 채움${tokenInfo}${json.summary ? ' · ' + json.summary : ''}`;
      renderListingDetailStatus();
    } catch (e) {
      console.error('[listing] 자동 생성 실패:', e);
      status.style.color = '#B91C1C';
      status.textContent = '❌ 실패: ' + (e.message || '알 수 없는 오류');
    } finally {
      btn.disabled = false;
    }
  }
  function serializeFactsForListing(master, listing) {
    const f = master.masterFacts || {};
    const emp = new Set(listing.emphasizedFactIds || []);
    const out = [];
    const renderItem = (it, fmt) => {
      const star = emp.has(it.id) ? '★ ' : '  ';
      return `${star}${fmt(it)}${it.source ? ` (출처: ${it.source})` : ''}`;
    };
    const groups = [
      ['keySpecs', '핵심 수치', it => `${it.label}: ${it.value}${it.unit ? ' ' + it.unit : ''}`],
      ['sellingPoints', '소구점', it => it.text],
      ['targetUses', '용도', it => it.text],
      ['certifications', '인증', it => `${it.name}${it.agency ? ' (' + it.agency + ')' : ''}`],
      ['composition', '성분·구성', it => it.text],
      ['cautions', '주의', it => it.text],
    ];
    groups.forEach(([k, title, fmt]) => {
      const items = (f[k] || []).filter(it => it.approved !== false);
      if (!items.length) return;
      out.push(`\n[${title}]`);
      items.forEach(it => out.push(renderItem(it, fmt)));
    });
    return out.join('\n') + '\n\n※ ★ 표시된 사실은 이 상품에서 강조해야 할 항목입니다.';
  }

  // ── 상품 저장
  async function saveListingEditor() {
    const ctx = listingEditorCtx; if (!ctx) return;
    const masterId = document.getElementById('leMaster').value;
    const name = document.getElementById('leName').value.trim();
    if (!masterId) { toast('모제품을 선택하세요', 'error'); switchListingTab('basic'); return; }
    if (!name) { toast('상품명을 입력하세요', 'error'); switchListingTab('basic'); return; }
    ctx.draft.productId = masterId;
    ctx.draft.targetSubstrate = document.getElementById('leSubstrate').value;
    ctx.draft.listingName = name;
    ctx.draft.cafe24ProductNo = document.getElementById('leCafe24').value.trim().replace(/[^0-9]/g, '');
    ctx.draft.customSlogan = document.getElementById('leSlogan').value.trim();
    ctx.draft.searchKeywords = document.getElementById('leKeywords').value.split(',').map(s => s.trim()).filter(Boolean);
    ctx.draft.colorOptions = document.getElementById('leColors').value.split(',').map(s => s.trim()).filter(Boolean);
    const customPrim = document.getElementById('leCustomPrimaryText').value.trim();
    ctx.draft.customColors = { primary: /^#[0-9A-F]{6}$/i.test(customPrim) ? customPrim : '', secondary: '' };
    ctx.draft.thumbnailImageUrl = document.getElementById('leThumbnail').value.trim();
    const ok = await saveListing(ctx.draft);
    if (ok) {
      closeModal('listingEditor');
      listingEditorCtx = null;
      renderListingList();
      toast('상품 저장됨', 'success');
      if (document.body.getAttribute('data-mode') === 'product') refreshProductDashboard();
    }
  }

  // ── 자식 상품 분기 제안 모달
  // POUR 도메인 키워드 사전 — 첫 매칭 우선 (특정 → 일반 순서)
  // suffix: 상품명 어미 (예: "페인트", "코팅", "방수페인트")
  // category: '지붕재'·'옥상'·'외벽'·'바닥'·'실내' 등 분류 (참고용)
  const SUBSTRATE_RULES = [
    // 지붕재 (특정 → 일반)
    { match: ['아스팔트슁글','슁글'], vibe: 'bold-industrial', suffix: '페인트', slogan: '노후 슁글에 새 옷을 — 방수·자외선 차단·강풍 대응', category: '지붕재' },
    { match: ['금속기와','칼라강판'], vibe: 'cool-tech', suffix: '코팅', slogan: '녹·열화 차단 — 색상 회복 + 부식 보호', category: '지붕재' },
    { match: ['박공지붕','경사지붕'], vibe: 'bold-industrial', suffix: '방수페인트', slogan: '경사 지붕 누수 차단 + 단열 한 번에', category: '지붕재' },
    // 옥상·방수
    { match: ['옥상슬라브','슬라브'], vibe: 'bold-industrial', suffix: '방수페인트', slogan: '옥상 누수 차단 — 무동력 통기로 들뜸 방지', category: '옥상' },
    { match: ['옥상'], vibe: 'bold-industrial', suffix: '방수페인트', slogan: '옥상 방수·차열 — 한 번 시공으로 두 효과', category: '옥상' },
    { match: ['우레탄방수'], vibe: 'cool-tech', suffix: '코팅', slogan: '고탄성 우레탄 — 균열 추종성', category: '옥상' },
    { match: ['아크릴배면','배면차수'], vibe: 'bold-industrial', suffix: '차수재', slogan: '지하 배면 누수 — 초고압 주입 차단', category: '지하' },
    { match: ['PVC방수'], vibe: 'bold-industrial', suffix: '방수재', slogan: '국토부 신기술 — 지하·옥상 복합 누수', category: '지하' },
    // 지하·바닥
    { match: ['지하주차장','주차장'], vibe: 'bold-industrial', suffix: '코팅', slogan: '차량 통행에 견디는 강도 — 내마모·내약품', category: '바닥' },
    { match: ['에폭시'], vibe: 'cool-tech', suffix: '코팅', slogan: '내마모·내약품 에폭시 마감 — 공장·창고 적합', category: '바닥' },
    { match: ['엠보라이닝','엠보'], vibe: 'bold-industrial', suffix: '코팅', slogan: '미끄럼 저항 + 반복하중 — 회전 구간 강화', category: '바닥' },
    { match: ['MMA'], vibe: 'bold-industrial', suffix: '코팅', slogan: '논슬립 고강도 — 미끄럼저항 BPN 인증', category: '바닥' },
    // 토목
    { match: ['아스콘','포트홀','도로'], vibe: 'bold-industrial', suffix: '보수재', slogan: '도로 균열·포트홀 빠른 보수', category: '토목' },
    { match: ['보도블록','블럭'], vibe: 'earth-rough', suffix: '보수재', slogan: '보도블록 균열·침하 보수', category: '토목' },
    { match: ['씰코팅'], vibe: 'bold-industrial', suffix: '코팅', slogan: '주차장·도로 표면 보호 코팅', category: '토목' },
    // 외벽재
    { match: ['드라이비트'], vibe: 'earth-rough', suffix: '페인트', slogan: '드라이비트 균열 보수 + 재도장', category: '외벽' },
    { match: ['사이딩'], vibe: 'earth-rough', suffix: '페인트', slogan: '사이딩 외벽 — 색상 회복 + 보호', category: '외벽' },
    { match: ['노출콘크리트'], vibe: 'earth-rough', suffix: '코팅', slogan: '노출콘크리트 보호 — 미관 + 발수', category: '외벽' },
    { match: ['외벽'], vibe: 'earth-rough', suffix: '페인트', slogan: '외벽 균열 보수 + 재도장', category: '외벽' },
    { match: ['벽돌','적벽돌'], vibe: 'earth-rough', suffix: '페인트', slogan: '벽돌 외장 미관 + 방수 — 한 번에', category: '외벽' },
    { match: ['석재'], vibe: 'earth-rough', suffix: '코팅', slogan: '석재 보호 — 발수·방오·미관 유지', category: '외벽' },
    // 데크 (외장 목재 — earth-rough 우선)
    { match: ['데크','우드데크','목재데크'], vibe: 'earth-rough', suffix: '페인트', slogan: '외장 데크 — 자외선·수분 차단 방부', category: '데크' },
    // 목재·우드 (실내)
    { match: ['우드'], vibe: 'warm-natural', suffix: '페인트', slogan: '오래가는 목재 마감 — 부착·발색', category: '목재' },
    { match: ['목재'], vibe: 'warm-natural', suffix: '페인트', slogan: '목재 보호 + 발색 — 무독성·친환경', category: '목재' },
    // 철재·금속
    { match: ['난간','펜스'], vibe: 'cool-tech', suffix: '페인트', slogan: '난간·펜스 — 녹 방지 + 외관 회복', category: '철재' },
    { match: ['철문','셔터'], vibe: 'cool-tech', suffix: '페인트', slogan: '철문·셔터 — 부식 방지·강한 부착', category: '철재' },
    { match: ['철재','금속','스틸','강재'], vibe: 'cool-tech', suffix: '페인트', slogan: '녹·부식 방지 — 강한 부착·내후성', category: '철재' },
    // 실내·벽체
    { match: ['천장'], vibe: 'clean-bright', suffix: '페인트', slogan: '천장 — 무취·친환경·결로 대응', category: '실내' },
    { match: ['벽체','내벽','실내벽'], vibe: 'clean-bright', suffix: '페인트', slogan: '실내 벽체 — 깔끔한 마감·무취·친환경', category: '실내' },
    { match: ['실내'], vibe: 'clean-bright', suffix: '페인트', slogan: '실내 마감 — 친환경·무취·발색', category: '실내' },
    // 콘크리트·시멘트 (일반)
    { match: ['콘크리트','시멘트'], vibe: 'bold-industrial', suffix: '코팅', slogan: '콘크리트 강화 — 중성화 차단·마모 저항', category: '구조' },
    { match: ['바닥'], vibe: 'bold-industrial', suffix: '코팅', slogan: '바닥 강화·마모 저항', category: '바닥' },
  ];
  function matchSubstrateRule(substrate) {
    const s = (substrate || '').replace(/\s/g, '');
    for (const rule of SUBSTRATE_RULES) {
      if (rule.match.some(m => s.includes(m.replace(/\s/g, '')))) return rule;
    }
    return { vibe: 'warm-natural', suffix: '페인트', slogan: `${substrate}용 — 사실 카드 기반 카피 작성 필요`, category: '기타' };
  }

  let branchSuggestCtx = null;
  function openBranchSuggestModal() {
    branchSuggestCtx = { masterId: '', selected: new Set(), suggests: [], mode: '' };
    const sel = document.getElementById('bsMaster');
    sel.innerHTML = '<option value="">— 모제품 선택 —</option>';
    productsCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `📦 ${p.name || p.productCode}`;
      sel.appendChild(opt);
    });
    document.getElementById('bsSubstrateSection').style.display = 'none';
    document.getElementById('bsModeSection').style.display = 'none';
    document.getElementById('bsSuggestSection').style.display = 'none';
    document.getElementById('bsRunStatus').style.display = 'none';
    document.getElementById('bsCreate').disabled = true;
    document.getElementById('bsHint').textContent = '마스터 선택 시 적용기재가 표시됩니다.';
    openModal('branchSuggestModal');
  }
  function onBranchMasterChange() {
    const id = document.getElementById('bsMaster').value;
    branchSuggestCtx.masterId = id;
    branchSuggestCtx.suggests = [];
    branchSuggestCtx.selected = new Set();
    if (!id) {
      document.getElementById('bsSubstrateSection').style.display = 'none';
      document.getElementById('bsModeSection').style.display = 'none';
      document.getElementById('bsSuggestSection').style.display = 'none';
      document.getElementById('bsCreate').disabled = true;
      return;
    }
    const master = productsCache.find(p => p.id === id);
    const substrates = (master && master.masterFacts && master.masterFacts.compatibleSubstrates || [])
      .filter(s => s.approved !== false).map(s => s.name);
    const subWrap = document.getElementById('bsSubstrateList');
    subWrap.innerHTML = '';
    document.getElementById('bsSubstrateSection').style.display = '';
    if (!substrates.length) {
      subWrap.innerHTML = '<span style="font-size:12px; color:#B91C1C;">⚠ 마스터의 적용기재가 비어있습니다 — 제품 편집기 ③ 사실 카드에서 추가하거나, AI 제안을 사용하세요(다른 사실까지 종합).</span>';
    } else {
      substrates.forEach(s => {
        const chip = document.createElement('span');
        chip.className = 'pe-chip'; chip.textContent = s;
        subWrap.appendChild(chip);
      });
    }
    document.getElementById('bsModeSection').style.display = '';
    document.getElementById('bsSuggestSection').style.display = 'none';
    document.getElementById('bsCreate').disabled = true;
    document.getElementById('bsHint').textContent = '🪄 빠른 제안 또는 🤖 AI 제안 중 선택하세요.';
  }

  // ── 빠른 제안 (사전 기반)
  function runQuickSuggest() {
    const ctx = branchSuggestCtx; if (!ctx || !ctx.masterId) return;
    const master = productsCache.find(p => p.id === ctx.masterId);
    if (!master) return;
    const substrates = (master.masterFacts && master.masterFacts.compatibleSubstrates || [])
      .filter(s => s.approved !== false).map(s => s.name);
    if (!substrates.length) {
      toast('적용기재가 없어 빠른 제안 불가 — AI 제안을 사용하거나 제품 편집기에서 기재 추가', 'error');
      return;
    }
    const productKind = (master.name || '').match(/(도료|페인트|코트|코팅)/) ? '' : '';
    ctx.mode = 'quick';
    ctx.suggests = substrates.map(s => {
      const r = matchSubstrateRule(s);
      return {
        listingName: `${s}${r.suffix}`,
        primarySubstrate: s,
        targetUseRefined: `${s} (${r.category})`,
        suggestedVibe: r.vibe,
        vibeReason: `사전 매칭: ${r.category} 카테고리`,
        customSlogan: r.slogan,
        searchKeywords: [`${s}${r.suffix}`, `${s}코팅`, `${s}보수`].filter((v, i, a) => a.indexOf(v) === i),
        emphasizedFactIds: [],
      };
    });
    renderSuggestResults();
  }

  // ── AI 제안 (Claude)
  async function runAISuggest() {
    const ctx = branchSuggestCtx; if (!ctx || !ctx.masterId) return;
    const master = productsCache.find(p => p.id === ctx.masterId);
    if (!master) return;
    if (!master.masterFacts || countTotalFacts(master.masterFacts) === 0) {
      toast('마스터 사실 카드가 비어있습니다 — 먼저 제품 편집기에서 사실 추출을 진행하세요', 'error');
      return;
    }
    await loadClaudeProxyConfig();
    if (!claudeProxyConfig || !claudeProxyConfig.workerUrl || !claudeProxyConfig.workerSecret || !claudeProxyConfig.claudeApiKey) {
      toast('⚙ Claude 자동채우기 설정이 필요합니다', 'error');
      return;
    }
    const status = document.getElementById('bsRunStatus');
    const btnQuick = document.getElementById('bsRunQuick');
    const btnAI = document.getElementById('bsRunAI');
    btnQuick.disabled = true; btnAI.disabled = true;
    status.style.display = ''; status.style.background = '#EFF6FF'; status.style.color = '#1E40AF';
    status.textContent = '🤖 Claude가 마스터 사실 종합 분석 중... (30초~1분)';

    const factsForAI = serializeFactsForAISuggest(master);
    const sysPrompt = [
      '당신은 한국어 건축자재 카페24 상품 기획 전문가입니다.',
      '모제품의 사실(적용기재·소구점·용도·인증·주의)을 종합 분석해 카페24 등록할 자식 상품(Listing)을 제안하세요.',
      '',
      '【엄격 규칙】',
      '1. 같은 적용기재라도 용도(외장/실내·노출/비노출)가 다르면 자식 상품을 분리하세요.',
      '   예: "목재" → 외장 데크용(자외선·방부) + 실내 가구용(무독성·발색) → 2개 상품',
      '2. 카페24 검색에서 고객이 실제 입력할 만한 용어를 listingName으로.',
      '3. emphasizedFactIds는 입력으로 받은 fact ID(spec-xxx, sp-xxx 등) 중에서만 선택. 임의 ID 만들지 마세요.',
      '4. suggestedVibe는 다음 5종 중 정확히 하나: warm-natural | cool-tech | clean-bright | bold-industrial | earth-rough',
      '   - warm-natural: 따뜻·자연 (실내 목재·우드 톤)',
      '   - cool-tech: 차가움·견고 (철재·금속·산업)',
      '   - clean-bright: 깔끔·밝음 (실내·벽체·일반)',
      '   - bold-industrial: 강함·임팩트 (외장·공업·콘크리트·지붕방수)',
      '   - earth-rough: 자연·거침 (벽돌·외벽·자연석·외장 데크)',
      '5. 너무 많이 만들지 마세요 — 의미 있는 분기 3~6개가 적정.',
      '',
      '【출력 JSON 스키마】 — JSON 외 텍스트 금지. 코드펜스 금지.',
      '{',
      '  "suggestedListings": [{',
      '    "listingName": "아스팔트슁글페인트",',
      '    "primarySubstrate": "아스팔트슁글",',
      '    "targetUseRefined": "노후 슁글 지붕 보호 + 방수",',
      '    "suggestedVibe": "bold-industrial",',
      '    "vibeReason": "지붕은 햇볕·강풍·우수 노출 → 강함·견고함이 신뢰감",',
      '    "customSlogan": "<한 줄 카피>",',
      '    "searchKeywords": ["아스팔트슁글페인트","슁글도색","지붕방수페인트"],',
      '    "emphasizedFactIds": ["spec-XX","sp-YY"]',
      '  }],',
      '  "summary": "<1~2문장 분석 요약>"',
      '}',
    ].join('\n');
    const userText = [
      `【모제품】 ${master.name} (${master.productCode || ''})`,
      master.description ? `【설명】 ${master.description}` : '',
      '',
      factsForAI,
      '',
      '위 사실을 종합해 자식 상품을 제안하세요. 같은 기재도 용도가 다르면 분리하세요.',
    ].filter(Boolean).join('\n');

    try {
      const r = await fetch(claudeProxyConfig.workerUrl.replace(/\/$/, ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': claudeProxyConfig.workerSecret },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          system: sysPrompt,
          messages: [{ role: 'user', content: userText }],
          claudeApiKey: claudeProxyConfig.claudeApiKey,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const json = extractClaudeJson(data);
      const suggests = (json.suggestedListings || []).filter(x => x.listingName).map(s => ({
        listingName: s.listingName,
        primarySubstrate: s.primarySubstrate || '',
        targetUseRefined: s.targetUseRefined || '',
        suggestedVibe: VIBE_PRESETS.find(v => v.id === s.suggestedVibe) ? s.suggestedVibe : 'warm-natural',
        vibeReason: s.vibeReason || '',
        customSlogan: s.customSlogan || '',
        searchKeywords: Array.isArray(s.searchKeywords) ? s.searchKeywords : [],
        emphasizedFactIds: Array.isArray(s.emphasizedFactIds) ? s.emphasizedFactIds : [],
      }));
      if (!suggests.length) throw new Error('AI 제안 결과가 비어있습니다');
      ctx.mode = 'ai';
      ctx.suggests = suggests;
      ctx.selected = new Set();
      const usage = data.usage || {};
      const tokenInfo = usage.input_tokens ? ` · 토큰 ${usage.input_tokens}/${usage.output_tokens}` : '';
      status.style.background = '#ECFDF5'; status.style.color = '#065F46';
      status.textContent = `✅ AI 제안 완료 — ${suggests.length}개 상품${tokenInfo}${json.summary ? ' · ' + json.summary : ''}`;
      renderSuggestResults();
    } catch (e) {
      console.error('[branch-ai] 실패:', e);
      status.style.background = '#FEE2E2'; status.style.color = '#991B1B';
      status.textContent = '❌ AI 제안 실패: ' + (e.message || '알 수 없는 오류');
    } finally {
      btnQuick.disabled = false; btnAI.disabled = false;
    }
  }
  function serializeFactsForAISuggest(master) {
    const f = master.masterFacts || {};
    const out = [];
    const subs = (f.compatibleSubstrates || []).filter(it => it.approved !== false);
    if (subs.length) out.push('[적용기재] ' + subs.map(s => s.name).join(', '));
    const groups = [
      ['keySpecs', '핵심수치', it => `${it.id} | ${it.label}: ${it.value}${it.unit ? ' ' + it.unit : ''}`],
      ['sellingPoints', '소구점', it => `${it.id} | ${it.text}`],
      ['targetUses', '용도', it => `${it.id} | ${it.text}`],
      ['certifications', '인증', it => `${it.id} | ${it.name}${it.agency ? ' (' + it.agency + ')' : ''}`],
      ['composition', '성분·구성', it => `${it.id} | ${it.text}`],
      ['cautions', '주의', it => `${it.id} | ${it.text}`],
    ];
    groups.forEach(([k, title, fmt]) => {
      const items = (f[k] || []).filter(it => it.approved !== false);
      if (!items.length) return;
      out.push(`\n[${title}]`);
      items.forEach(it => out.push('- ' + fmt(it)));
    });
    return out.join('\n');
  }

  // ── 제안 결과 렌더 (두 모드 공통)
  function renderSuggestResults() {
    const ctx = branchSuggestCtx; if (!ctx) return;
    const master = productsCache.find(p => p.id === ctx.masterId);
    const factsById = collectFactsById(master);
    const wrap = document.getElementById('bsSuggestList');
    wrap.innerHTML = '';
    document.getElementById('bsSuggestTitle').textContent =
      `${ctx.mode === 'ai' ? '🤖 AI' : '🪄 빠른'} 제안 — 체크한 항목만 생성 (${ctx.suggests.length}개)`;
    ctx.suggests.forEach((s, idx) => {
      const v = findVibe(s.suggestedVibe);
      const row = document.createElement('div');
      row.className = 'lb-suggest-row' + (ctx.mode === 'ai' ? ' lb-suggest-ai' : '');
      const empNames = (s.emphasizedFactIds || []).map(id => {
        const it = factsById[id];
        if (!it) return null;
        return it.label || it.text || it.name || id;
      }).filter(Boolean);
      row.innerHTML = `
        <input type="checkbox" data-idx="${idx}" />
        <div>
          <div class="lb-suggest-name">${escapeHtml(s.listingName)}</div>
          <div class="lb-suggest-meta">기재: <b>${escapeHtml(s.primarySubstrate || '-')}</b>${s.targetUseRefined ? ` · 용도: ${escapeHtml(s.targetUseRefined)}` : ''}</div>
          ${s.customSlogan ? `<div class="lb-suggest-meta">💬 ${escapeHtml(s.customSlogan)}</div>` : ''}
          ${ctx.mode === 'ai' && s.vibeReason ? `<div class="lb-suggest-reason">vibe 이유: ${escapeHtml(s.vibeReason)}</div>` : ''}
          ${empNames.length ? `<div class="lb-suggest-emp">강조 사실 <b>${empNames.length}</b>개 — ${empNames.slice(0, 3).map(escapeHtml).join(', ')}${empNames.length > 3 ? ` 외 ${empNames.length - 3}` : ''}</div>` : ''}
          ${(s.searchKeywords || []).length ? `<div class="lb-suggest-keywords">${s.searchKeywords.slice(0, 5).map(k => `<span>${escapeHtml(k)}</span>`).join('')}</div>` : ''}
        </div>
        <span class="lb-suggest-vibe" style="background:${v.bgColor}; color:${v.primaryColor};">${v.emoji} ${escapeHtml(v.name)}</span>
      `;
      row.querySelector('input').addEventListener('change', e => {
        if (e.target.checked) ctx.selected.add(idx);
        else ctx.selected.delete(idx);
        row.classList.toggle('lb-suggest-checked', e.target.checked);
        document.getElementById('bsCreate').disabled = ctx.selected.size === 0;
        document.getElementById('bsHint').textContent = ctx.selected.size
          ? `${ctx.selected.size}개 상품 생성 예정`
          : '체크한 항목만 일괄 생성됩니다.';
      });
      wrap.appendChild(row);
    });
    document.getElementById('bsSuggestSection').style.display = '';
    document.getElementById('bsCreate').disabled = true;
    document.getElementById('bsHint').textContent = '체크한 항목만 일괄 생성됩니다.';
  }
  function collectFactsById(master) {
    const map = {};
    if (!master || !master.masterFacts) return map;
    const f = master.masterFacts;
    ['keySpecs','sellingPoints','composition','certifications','compatibleSubstrates','targetUses','cautions']
      .forEach(k => (f[k] || []).forEach(it => { if (it && it.id) map[it.id] = it; }));
    return map;
  }
  async function createSuggestedListings() {
    const ctx = branchSuggestCtx; if (!ctx || !ctx.masterId) return;
    const toCreate = Array.from(ctx.selected).map(i => ctx.suggests[i]).filter(Boolean);
    if (!toCreate.length) return;
    if (!confirm(`${toCreate.length}개 상품을 생성합니다.\n${ctx.mode === 'ai' ? '(AI 제안 — 강조 사실·검색키워드까지 자동 채움)' : '(빠른 제안 — 키워드 사전 기반)'}\n진행할까요?`)) return;
    document.getElementById('bsCreate').disabled = true;
    document.getElementById('bsHint').textContent = '생성 중...';
    let ok = 0, fail = 0;
    for (const s of toCreate) {
      const lst = newListing();
      lst.productId = ctx.masterId;
      lst.listingName = s.listingName;
      lst.targetSubstrate = s.primarySubstrate;
      lst.customSlogan = s.customSlogan || '';
      lst.vibe = s.suggestedVibe;
      lst.searchKeywords = s.searchKeywords || [];
      lst.emphasizedFactIds = s.emphasizedFactIds || [];
      const success = await saveListing(lst);
      if (success) ok++; else fail++;
    }
    closeModal('branchSuggestModal');
    branchSuggestCtx = null;
    renderListingList();
    refreshProductDashboard();
    toast(`완료 — 성공 ${ok}건${fail ? ` / 실패 ${fail}건` : ''}`, fail ? 'info' : 'success');
  }

  // ── wire-up
  function wireListingsAndDashboard() {
    // 모드 토글 탭
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.addEventListener('click', () => setAppMode(t.dataset.mode));
    });
    // 대시보드 — 단계별 가이드 액션
    const wire = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    // STEP A
    wire('dashGoNewProduct', () => openProductEditor(null));
    wire('dashGoProducts', openProductsModal);
    // STEP B
    wire('dashGoSuggest', openBranchSuggestModal);
    wire('dashGoNewListing', () => openListingEditor(null));
    wire('dashGoListings', openListingsModal);
    // STEP C
    wire('dashGoListingsForDetail', openListingsModal);
    wire('dashGoInstances2', openInstancesModal);
    wire('dashGoBatchAutoFill', openBatchAutoFillModal);
    // STEP D
    wire('dashGoBatchGen', openBatchGenModal);
    wire('dashGoInstances3', openInstancesModal);
    // 사용자가 details 토글 시 기억 — 완료 후 자동 접기 동작 회피
    const onbDetail = document.getElementById('dashOnboard');
    if (onbDetail) onbDetail.addEventListener('toggle', () => {
      if (onbDetail.open) onbDetail.dataset.userOpened = '1';
    });
    // 가이드 모달
    wire('btnDashHelp', openGuideModal);
    wire('gdClose', () => closeModal('guideModal'));
    wire('gdStart', () => {
      const never = document.getElementById('gdNeverShow').checked;
      try { localStorage.setItem('pourstore-guide-seen', '1'); if (never) localStorage.setItem('pourstore-guide-never', '1'); } catch (_) {}
      closeModal('guideModal');
    });
    // 상품 목록 모달
    document.getElementById('btnListings').addEventListener('click', openListingsModal);
    document.getElementById('lstClose').addEventListener('click', () => closeModal('listingsModal'));
    document.getElementById('lstCloseFoot').addEventListener('click', () => closeModal('listingsModal'));
    document.getElementById('lstNew').addEventListener('click', () => openListingEditor(null));
    document.getElementById('lstSuggestBranches').addEventListener('click', openBranchSuggestModal);
    // 상품 편집기
    document.querySelectorAll('#listingEditor .le-tab').forEach(b => {
      b.addEventListener('click', () => switchListingTab(b.dataset.tab));
    });
    document.getElementById('leMaster').addEventListener('change', onListingMasterChange);
    document.getElementById('leClose').addEventListener('click', () => { closeModal('listingEditor'); listingEditorCtx = null; });
    document.getElementById('leCancel').addEventListener('click', () => { closeModal('listingEditor'); listingEditorCtx = null; });
    document.getElementById('leSave').addEventListener('click', saveListingEditor);
    document.getElementById('leDelete').addEventListener('click', async () => {
      if (listingEditorCtx && listingEditorCtx.mode === 'edit') {
        await deleteListing(listingEditorCtx.draft.id);
        if (!listingsCache.find(l => l.id === listingEditorCtx.draft.id)) {
          closeModal('listingEditor'); listingEditorCtx = null;
        }
      }
    });
    document.getElementById('leGenerateDetail').addEventListener('click', generateDetailFromListing);
    document.getElementById('leResetPrimary').addEventListener('click', () => {
      if (!listingEditorCtx) return;
      const v = findVibe(listingEditorCtx.draft.vibe);
      document.getElementById('leCustomPrimary').value = v.primaryColor;
      document.getElementById('leCustomPrimaryText').value = '';
      listingEditorCtx.draft.customColors = { primary: '', secondary: '' };
    });
    const cp = document.getElementById('leCustomPrimary');
    cp.addEventListener('input', () => { document.getElementById('leCustomPrimaryText').value = cp.value.toUpperCase(); });
    // 분기 제안 모달
    document.getElementById('bsClose').addEventListener('click', () => closeModal('branchSuggestModal'));
    document.getElementById('bsCancel').addEventListener('click', () => closeModal('branchSuggestModal'));
    document.getElementById('bsMaster').addEventListener('change', onBranchMasterChange);
    document.getElementById('bsRunQuick').addEventListener('click', runQuickSuggest);
    document.getElementById('bsRunAI').addEventListener('click', runAISuggest);
    document.getElementById('bsCreate').addEventListener('click', createSuggestedListings);
  }

  // -------- 상세페이지 인스턴스 (Step C) --------
  // 인스턴스는 별도 컬렉션(pourstore-renewal-instances)에 1개=1문서로 저장.
  // state.instancesCache는 메모리 캐시용으로만 쓰고 Firestore 빌더 문서에는 안 들어감.
  const INSTANCES_COLLECTION = 'pourstore-renewal-instances';
  let instancesCache = [];

  function applyTemplateWithSlots(tpl, slotValues) {
    let html = (tpl && tpl.html) || '';
    (tpl && tpl.slots || []).forEach(s => {
      const v = (slotValues && slotValues[s.key] !== undefined && slotValues[s.key] !== '')
        ? slotValues[s.key]
        : (s.defaultValue !== '' && s.defaultValue != null ? s.defaultValue : `[${s.label || s.key}]`);
      const re = new RegExp('\\{\\{\\s*' + s.key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*\\}\\}', 'g');
      html = html.replace(re, v);
    });
    return html;
  }

  async function loadInstances() {
    if (!firebaseReady || !db) {
      toast('Firebase 미연결 — 인스턴스 목록 로드 불가', 'error');
      return [];
    }
    try {
      const snap = await db.collection(INSTANCES_COLLECTION).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      instancesCache = docs;
      console.log(`[instances] ${docs.length}건 로드`);
      return docs;
    } catch (e) {
      console.error('[instances] 로드 실패:', e);
      toast('상세페이지 목록 로드 실패: ' + (e.code || e.message || ''), 'error');
      return [];
    }
  }
  async function saveInstance(inst) {
    if (!firebaseReady || !db) { toast('오프라인 — 저장 불가', 'error'); return false; }
    const me = getMeStaff();
    inst.updatedAt = nowIso();
    inst.updatedByName = me ? me.name : '익명';
    if (!inst.createdAt) {
      inst.createdAt = inst.updatedAt;
      inst.createdByName = me ? me.name : '익명';
    }
    try {
      await db.collection(INSTANCES_COLLECTION).doc(inst.id).set(inst, { merge: false });
      const idx = instancesCache.findIndex(i => i.id === inst.id);
      if (idx >= 0) instancesCache[idx] = inst; else instancesCache.unshift(inst);
      return true;
    } catch (e) {
      console.error('[instances] 저장 실패:', e);
      toast('저장 실패: ' + (e.code || e.message || ''), 'error');
      return false;
    }
  }
  async function deleteInstance(id) {
    const inst = instancesCache.find(i => i.id === id);
    if (!inst) return;
    if (!confirm(`'${inst.name}' 상세페이지를 삭제할까요? (복구 불가)`)) return;
    if (!firebaseReady || !db) { toast('오프라인 — 삭제 불가', 'error'); return; }
    try {
      await db.collection(INSTANCES_COLLECTION).doc(id).delete();
      instancesCache = instancesCache.filter(i => i.id !== id);
      renderInstanceList();
      toast('삭제됨', 'info');
    } catch (e) {
      console.error('[instances] 삭제 실패:', e);
      toast('삭제 실패: ' + (e.code || e.message || ''), 'error');
    }
  }

  // -------- 인스턴스 목록 모달 --------
  async function openInstancesModal() {
    document.getElementById('insListWrap').innerHTML = '<div class="empty-history">불러오는 중...</div>';
    openModal('instancesModal');
    await loadInstances();
    renderInstanceList();
  }
  function renderInstanceList() {
    const wrap = document.getElementById('insListWrap');
    if (!wrap) return;
    if (instancesCache.length === 0) {
      wrap.innerHTML = '<div class="empty-history">아직 만든 상세페이지가 없습니다.<br/>위 <b>+ 새 상세페이지</b>를 누르세요.</div>';
      return;
    }
    wrap.innerHTML = '';
    instancesCache.forEach(inst => {
      const tpl = findTemplate(inst.templateId);
      const filled = inst.slots ? Object.values(inst.slots).filter(v => v !== '' && v != null).length : 0;
      const slotTotal = tpl ? (tpl.slots || []).length : 0;
      const row = document.createElement('div');
      row.className = 'ins-row';
      row.innerHTML = `
        <div class="ins-meta">
          <div class="ins-name">📄 ${escapeHtml(inst.name)}</div>
          <div class="ins-tpl">${tpl ? '템플릿: ' + escapeHtml(tpl.name) : '<span style="color:#B91C1C;">템플릿 삭제됨</span>'}</div>
          <div class="ins-stats">
            <span>슬롯 ${filled}/${slotTotal}</span>
            <span>·</span>
            <span title="수정 ${escapeHtml(fmtDate(inst.updatedAt))}">${escapeHtml(fmtDate(inst.updatedAt))}</span>
            ${inst.updatedByName ? `<span>· ${escapeHtml(inst.updatedByName)}</span>` : ''}
          </div>
        </div>
        <div class="ins-actions">
          <button class="btn btn-sm btn-primary" data-act="edit">편집</button>
          <button class="btn btn-sm btn-danger" data-act="del" title="삭제">×</button>
        </div>
      `;
      row.querySelector('[data-act=edit]').addEventListener('click', () => openInstanceEditor(inst.id));
      row.querySelector('[data-act=del]').addEventListener('click', () => deleteInstance(inst.id));
      wrap.appendChild(row);
    });
  }

  // -------- 인스턴스 편집 모달 --------
  let instanceEditorCtx = null;
  function openInstanceEditor(idOrNull) {
    const list = state.templates || [];
    if (idOrNull) {
      const inst = instancesCache.find(i => i.id === idOrNull);
      if (!inst) { toast('인스턴스를 찾을 수 없습니다.', 'error'); return; }
      instanceEditorCtx = JSON.parse(JSON.stringify(inst));
    } else {
      // 새 인스턴스 — 템플릿 선택 필요
      if (list.length === 0) {
        toast('먼저 템플릿을 1개 이상 등록해 주세요.', 'error');
        closeModal('instancesModal');
        openTemplatesModal();
        return;
      }
      instanceEditorCtx = {
        id: 'inst-' + Math.random().toString(36).slice(2, 10),
        templateId: list[0].id,
        name: '',
        slots: {},
      };
    }
    document.getElementById('ieTitle').textContent = idOrNull ? `상세페이지 편집 — ${instanceEditorCtx.name || '(이름 없음)'}` : '새 상세페이지 만들기';
    // 템플릿 선택 셀렉트 채우기
    const tplSel = document.getElementById('ieTemplate');
    tplSel.innerHTML = '';
    list.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `📐 ${t.name}`;
      tplSel.appendChild(opt);
    });
    if (!findTemplate(instanceEditorCtx.templateId)) {
      const opt = document.createElement('option');
      opt.value = instanceEditorCtx.templateId;
      opt.textContent = '⚠ 템플릿 삭제됨 (다른 템플릿 선택 필요)';
      opt.disabled = true;
      opt.selected = true;
      tplSel.appendChild(opt);
    }
    tplSel.value = instanceEditorCtx.templateId;
    tplSel.disabled = !!idOrNull; // 편집 모드에서는 템플릿 변경 잠금
    document.getElementById('ieName').value = instanceEditorCtx.name || '';
    renderInstanceSlots();
    refreshInstancePreview();
    openModal('instanceEditor');
    setTimeout(() => document.getElementById('ieName').focus(), 60);
  }
  function renderInstanceSlots() {
    const wrap = document.getElementById('ieSlots');
    if (!wrap || !instanceEditorCtx) return;
    const tpl = findTemplate(instanceEditorCtx.templateId);
    if (!tpl) {
      wrap.innerHTML = '<div class="empty-history">템플릿을 먼저 선택하세요.</div>';
      return;
    }
    const slots = tpl.slots || [];
    if (slots.length === 0) {
      wrap.innerHTML = '<div class="empty-history">이 템플릿엔 슬롯이 없습니다. (HTML이 그대로 출력됨)</div>';
      return;
    }
    wrap.innerHTML = '';
    slots.forEach(s => {
      const row = document.createElement('div');
      row.className = 'ie-slot ie-type-' + s.type;
      const val = (instanceEditorCtx.slots && instanceEditorCtx.slots[s.key] !== undefined)
        ? instanceEditorCtx.slots[s.key]
        : '';
      let inputHtml;
      if (s.type === 'textarea') {
        inputHtml = `<textarea class="ie-slot-input" data-key="${escapeHtml(s.key)}" placeholder="${escapeHtml(s.defaultValue || '')}" rows="3">${escapeHtml(val)}</textarea>`;
      } else if (s.type === 'image') {
        inputHtml = `
          <div class="ie-image-drop" data-key="${escapeHtml(s.key)}" tabindex="0" role="button" aria-label="이미지 업로드">
            <input type="file" class="ie-image-file" accept="image/*" data-key="${escapeHtml(s.key)}" hidden />
            <div class="ie-image-drop-hint">
              🖼️ 이미지 끌어다 놓기 · <kbd>Cmd/Ctrl+V</kbd> 붙여넣기 · <button type="button" class="ie-image-pick" data-key="${escapeHtml(s.key)}">파일 선택</button>
            </div>
            <div class="ie-image-progress" data-key="${escapeHtml(s.key)}"></div>
          </div>
          <input type="text" class="ie-slot-input" data-key="${escapeHtml(s.key)}" value="${escapeHtml(val)}" placeholder="이미지 URL (https://...) — 직접 입력도 가능" />
          ${val ? `<div class="ie-slot-thumb"><img src="${escapeHtml(val)}" alt="" onerror="this.style.opacity='.3';this.title='이미지를 불러올 수 없음'" /></div>` : ''}
        `;
      } else if (s.type === 'link') {
        inputHtml = `<input type="text" class="ie-slot-input" data-key="${escapeHtml(s.key)}" value="${escapeHtml(val)}" placeholder="https://..." />`;
      } else {
        inputHtml = `<input type="text" class="ie-slot-input" data-key="${escapeHtml(s.key)}" value="${escapeHtml(val)}" placeholder="${escapeHtml(s.defaultValue || '')}" />`;
      }
      row.innerHTML = `
        <div class="ie-slot-head">
          <span class="ie-slot-label">${escapeHtml(s.label || s.key)}</span>
          <span class="ie-slot-type-tag" title="${escapeHtml(s.key)}">${escapeHtml(slotTypeLabel(s.type))}</span>
        </div>
        <div class="ie-slot-body">${inputHtml}</div>
      `;
      const inp = row.querySelector('.ie-slot-input');
      inp.addEventListener('input', e => {
        instanceEditorCtx.slots = instanceEditorCtx.slots || {};
        instanceEditorCtx.slots[s.key] = e.target.value;
        // 이미지 타입은 썸네일 갱신
        if (s.type === 'image') renderInstanceSlots();
        refreshInstancePreview();
      });
      if (s.type === 'image') wireImageDrop(row, s.key);
      wrap.appendChild(row);
    });
  }

  // -------- Step D: 이미지 드래그업로드 (Firebase Storage) --------
  function wireImageDrop(row, slotKey) {
    const drop = row.querySelector('.ie-image-drop');
    const fileInput = row.querySelector('.ie-image-file');
    const pickBtn = row.querySelector('.ie-image-pick');
    if (!drop || !fileInput) return;

    const openPicker = () => fileInput.click();
    drop.addEventListener('click', e => {
      if (e.target === pickBtn) return; // pickBtn 자체 클릭은 별도 처리
      openPicker();
    });
    if (pickBtn) pickBtn.addEventListener('click', e => { e.stopPropagation(); openPicker(); });
    drop.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
    });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleImageFile(slotKey, file);
    });
    fileInput.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) handleImageFile(slotKey, file);
      e.target.value = ''; // 같은 파일 재선택 가능
    });

    // 클립보드 붙여넣기 — 드롭존 또는 URL 입력란에 포커스 후 Cmd/Ctrl+V
    const handlePaste = (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleImageFile(slotKey, file);
            return;
          }
        }
      }
    };
    drop.addEventListener('paste', handlePaste);
    const urlInput = row.querySelector('.ie-slot-input');
    if (urlInput) urlInput.addEventListener('paste', handlePaste);
  }

  async function handleImageFile(slotKey, file) {
    if (!file.type.startsWith('image/')) {
      toast('이미지 파일만 업로드할 수 있습니다', 'error'); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast('파일이 너무 큽니다 (최대 20MB)', 'error'); return;
    }
    const progEl = document.querySelector(`.ie-image-progress[data-key="${cssEscape(slotKey)}"]`);
    const setProg = (msg, cls) => {
      if (!progEl) return;
      progEl.textContent = msg;
      progEl.className = 'ie-image-progress' + (cls ? ' ' + cls : '');
      progEl.dataset.key = slotKey;
    };
    try {
      setProg('이미지 처리 중...', 'uploading');
      const { blob, mime } = await resizeImageToBlob(file);
      const url = await uploadImageToStorage(blob, mime, slotKey, (instanceEditorCtx && instanceEditorCtx.id) || 'tmp', pct => {
        setProg(`업로드 ${Math.round(pct)}%`, 'uploading');
      });
      // 슬롯 값 갱신 + 폼 재렌더
      instanceEditorCtx.slots = instanceEditorCtx.slots || {};
      instanceEditorCtx.slots[slotKey] = url;
      renderInstanceSlots();
      refreshInstancePreview();
      toast('이미지 업로드 완료', 'success');
    } catch (e) {
      console.error('[image-upload] 실패:', e);
      const msg = (e && e.code) ? e.code : (e && e.message) || '알 수 없는 오류';
      setProg('업로드 실패: ' + msg, 'error');
      toast('업로드 실패: ' + msg, 'error');
    }
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/["\\]/g, '\\$&');
  }

  async function resizeImageToBlob(file, maxDim = 1600, quality = 0.85) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > maxDim || h > maxDim) {
      const r = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * r); h = Math.round(h * r);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const isPng = file.type === 'image/png';
    const mime = isPng ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas toBlob 실패')),
        mime, isPng ? undefined : quality);
    });
    return { blob, mime };
  }

  async function uploadImageToStorage(blob, mime, slotKey, instanceId, onProgress) {
    if (typeof firebase === 'undefined' || !firebase.storage) {
      throw new Error('Firebase Storage SDK가 로드되지 않았습니다');
    }
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    const safeKey = String(slotKey || 'image').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeId = String(instanceId || 'tmp').replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `pourstore-detail/${safeId}/${safeKey}-${Date.now()}.${ext}`;
    const ref = firebase.storage().ref().child(path);
    const task = ref.put(blob, { contentType: mime, cacheControl: 'public, max-age=31536000' });
    return new Promise((resolve, reject) => {
      task.on('state_changed',
        snap => {
          if (onProgress && snap.totalBytes) {
            onProgress(snap.bytesTransferred / snap.totalBytes * 100);
          }
        },
        err => reject(err),
        async () => {
          try { resolve(await task.snapshot.ref.getDownloadURL()); }
          catch (e) { reject(e); }
        }
      );
    });
  }
  function slotTypeLabel(t) {
    const m = SLOT_TYPES.find(x => x.value === t);
    return m ? m.label : t;
  }
  function refreshInstancePreview() {
    const frame = document.getElementById('iePreview');
    if (!frame || !instanceEditorCtx) return;
    const tpl = findTemplate(instanceEditorCtx.templateId);
    if (!tpl) { frame.srcdoc = wrapPreview('<p style="padding:20px;font-family:sans-serif;color:#999;">템플릿이 없습니다.</p>'); return; }
    const html = applyTemplateWithSlots(tpl, instanceEditorCtx.slots || {});
    frame.srcdoc = wrapPreview(html);
  }
  function onInstanceTemplateChange() {
    const sel = document.getElementById('ieTemplate');
    instanceEditorCtx.templateId = sel.value;
    // 슬롯 값은 키 기준으로 살아있는 것만 유지 (자동으로 새 템플릿의 키로 매칭)
    renderInstanceSlots();
    refreshInstancePreview();
  }
  async function saveInstanceEditor() {
    if (!instanceEditorCtx) return;
    const name = document.getElementById('ieName').value.trim();
    if (!name) { toast('상세페이지 이름을 입력하세요.', 'error'); return; }
    if (!findTemplate(instanceEditorCtx.templateId)) {
      toast('유효한 템플릿을 선택하세요.', 'error'); return;
    }
    instanceEditorCtx.name = name;
    const ok = await saveInstance(instanceEditorCtx);
    if (ok) {
      closeModal('instanceEditor');
      renderInstanceList();
      toast('저장됨', 'success');
    }
  }

  // -------- 마누스 워커 설정 (Firestore: app-config/manus) --------
  let manusConfig = null; // { workerUrl, workerSecret }
  async function loadManusConfig() {
    if (!firebaseReady || !db) return null;
    try {
      const doc = await db.collection('app-config').doc('manus').get();
      manusConfig = doc.exists ? doc.data() : null;
      return manusConfig;
    } catch (e) {
      console.error('[manus] config 로드 실패:', e);
      return null;
    }
  }
  async function saveManusConfig(cfg) {
    if (!firebaseReady || !db) { toast('오프라인 — 저장 불가', 'error'); return false; }
    try {
      await db.collection('app-config').doc('manus').set({
        workerUrl: cfg.workerUrl || '',
        workerSecret: cfg.workerSecret || '',
        updatedAt: nowIso(),
      }, { merge: true });
      manusConfig = cfg;
      return true;
    } catch (e) {
      console.error('[manus] config 저장 실패:', e);
      toast('저장 실패: ' + (e.code || e.message), 'error');
      return false;
    }
  }
  async function openManusConfigModal() {
    await loadManusConfig();
    document.getElementById('mcUrl').value = (manusConfig && manusConfig.workerUrl) || '';
    document.getElementById('mcSecret').value = (manusConfig && manusConfig.workerSecret) || '';
    openModal('manusConfigModal');
  }
  async function saveManusConfigEditor() {
    const url = document.getElementById('mcUrl').value.trim();
    const secret = document.getElementById('mcSecret').value.trim();
    if (!url || !secret) { toast('URL과 시크릿 모두 입력하세요.', 'error'); return; }
    if (!/^https?:\/\//.test(url)) { toast('URL은 http(s)://로 시작해야 합니다.', 'error'); return; }
    const ok = await saveManusConfig({ workerUrl: url.replace(/\/$/, ''), workerSecret: secret });
    if (ok) {
      closeModal('manusConfigModal');
      toast('마누스 설정 저장됨', 'success');
      if (document.body.getAttribute('data-mode') === 'product') refreshProductDashboard();
    }
  }
  async function testManusConfig() {
    const url = document.getElementById('mcUrl').value.trim().replace(/\/$/, '');
    const secret = document.getElementById('mcSecret').value.trim();
    if (!url || !secret) { toast('URL과 시크릿 모두 입력 후 테스트하세요.', 'error'); return; }
    toast('연결 테스트 중...', 'info');
    try {
      const r = await fetch(url + '/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerSecret: secret, taskId: '__test__' }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) { toast('❌ 시크릿이 워커와 일치하지 않습니다.', 'error'); return; }
      if (r.status === 400 || (r.status === 502 && data && data.error)) {
        toast('✅ 워커 연결 OK (시크릿 검증 통과)', 'success'); return;
      }
      if (r.ok) { toast('✅ 워커 연결 OK', 'success'); return; }
      toast(`연결됨 — HTTP ${r.status}: ${data.error || '응답 확인 필요'}`, 'info');
    } catch (e) {
      toast('연결 실패: ' + e.message, 'error');
    }
  }

  async function manusCreate(prompt, agentProfile) {
    if (!manusConfig || !manusConfig.workerUrl || !manusConfig.workerSecret) throw new Error('마누스 설정 없음');
    const r = await fetch(manusConfig.workerUrl + '/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerSecret: manusConfig.workerSecret, prompt, agentProfile }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }
  async function manusStatus(taskId) {
    if (!manusConfig || !manusConfig.workerUrl || !manusConfig.workerSecret) throw new Error('마누스 설정 없음');
    const r = await fetch(manusConfig.workerUrl + '/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerSecret: manusConfig.workerSecret, taskId }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  // -------- 마누스 일괄 생성 (B안) --------
  let batchGenCtx = null;
  const BATCH_CONCURRENCY = 3;
  const BATCH_POLL_MS = 6000;
  const BATCH_MAX_POLL = 120; // 6초 × 120 = 12분 한도

  async function openBatchGenModal() {
    await loadManusConfig();
    const hasCfg = manusConfig && manusConfig.workerUrl && manusConfig.workerSecret;
    document.getElementById('bgWarnConfig').style.display = hasCfg ? 'none' : 'block';
    document.getElementById('bgConfigSection').style.display = hasCfg ? 'block' : 'none';
    document.getElementById('bgProgressSection').style.display = 'none';
    document.getElementById('bgStart').disabled = !hasCfg;
    document.getElementById('bgStart').style.display = '';

    if (hasCfg) {
      document.getElementById('bgInstanceList').innerHTML = '<div class="empty-history">불러오는 중...</div>';
      openModal('batchGenModal');
      await loadInstances();
      renderBatchInstanceList();
      renderBatchSlotOptions();
    } else {
      openModal('batchGenModal');
    }
  }
  function renderBatchSlotOptions() {
    const sel = document.getElementById('bgSlot');
    sel.innerHTML = '';
    const seenKeys = new Set();
    (state.templates || []).forEach(tpl => {
      (tpl.slots || []).forEach(s => {
        if (s.type === 'image' && !seenKeys.has(s.key)) {
          seenKeys.add(s.key);
          const opt = document.createElement('option');
          opt.value = s.key;
          opt.textContent = `${s.label || s.key} (${s.key})`;
          sel.appendChild(opt);
        }
      });
    });
    if (seenKeys.size === 0) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— 등록된 이미지 슬롯 없음 —'; opt.disabled = true;
      sel.appendChild(opt);
    }
  }
  function renderBatchInstanceList() {
    const wrap = document.getElementById('bgInstanceList');
    document.getElementById('bgTotal').textContent = instancesCache.length;
    if (instancesCache.length === 0) {
      wrap.innerHTML = '<div class="empty-history">상세페이지 인스턴스가 없습니다.</div>';
      return;
    }
    wrap.innerHTML = '';
    instancesCache.forEach(inst => {
      const tpl = findTemplate(inst.templateId);
      const row = document.createElement('label');
      row.className = 'bg-inst-row';
      row.innerHTML = `
        <input type="checkbox" data-id="${escapeHtml(inst.id)}" />
        <div class="bg-inst-meta">
          <div class="bg-inst-name">📄 ${escapeHtml(inst.name)}</div>
          <div class="bg-inst-tpl">${tpl ? escapeHtml(tpl.name) : '<span style="color:#B91C1C;">템플릿 삭제됨</span>'}</div>
        </div>
      `;
      row.querySelector('input').addEventListener('change', updateBatchSelCount);
      wrap.appendChild(row);
    });
    updateBatchSelCount();
  }
  function updateBatchSelCount() {
    const n = document.querySelectorAll('#bgInstanceList input:checked').length;
    document.getElementById('bgSelCount').textContent = n;
    document.getElementById('bgStart').disabled = (n === 0) || !manusConfig;
  }
  function selectAllBatch(check) {
    document.querySelectorAll('#bgInstanceList input').forEach(c => { c.checked = !!check; });
    updateBatchSelCount();
  }

  async function startBatchGen() {
    const prompt = document.getElementById('bgPrompt').value.trim();
    const slotKey = document.getElementById('bgSlot').value;
    const profile = document.getElementById('bgProfile').value;
    if (!prompt) { toast('프롬프트 템플릿을 입력하세요.', 'error'); return; }
    if (!slotKey) { toast('슬롯을 선택하세요.', 'error'); return; }
    const checked = Array.from(document.querySelectorAll('#bgInstanceList input:checked'));
    if (checked.length === 0) { toast('인스턴스를 1개 이상 선택하세요.', 'error'); return; }
    if (!confirm(`${checked.length}개 인스턴스에 대해 마누스 일괄 생성을 시작합니다.\n예상 크레딧: 약 ${checked.length * 150}\n진행할까요?`)) return;

    const items = checked.map(c => {
      const id = c.dataset.id;
      const inst = instancesCache.find(i => i.id === id);
      return {
        instanceId: id,
        name: inst ? inst.name : '(이름 없음)',
        status: 'pending',
        message: '',
        taskId: null,
        fileUrl: null,
      };
    });

    batchGenCtx = {
      running: true, cancelled: false, items,
      prompt, slotKey, profile,
      concurrency: BATCH_CONCURRENCY, ok: 0, fail: 0,
    };

    document.getElementById('bgConfigSection').style.display = 'none';
    document.getElementById('bgProgressSection').style.display = 'block';
    document.getElementById('bgStart').style.display = 'none';
    renderBatchProgress();
    await runBatchWorkers();
  }

  async function runBatchWorkers() {
    const ctx = batchGenCtx;
    let nextIdx = 0;
    const workers = [];
    for (let i = 0; i < ctx.concurrency; i++) {
      workers.push((async () => {
        while (true) {
          if (ctx.cancelled) return;
          const idx = nextIdx++;
          if (idx >= ctx.items.length) return;
          await processBatchItem(ctx, idx);
        }
      })());
    }
    await Promise.all(workers);
    ctx.running = false;
    renderBatchProgress();
    toast(`완료 — 성공 ${ctx.ok}건 / 실패 ${ctx.fail}건`, ctx.fail === 0 ? 'success' : 'info');
  }

  async function processBatchItem(ctx, idx) {
    const item = ctx.items[idx];
    const inst = instancesCache.find(i => i.id === item.instanceId);
    if (!inst) { item.status = 'failed'; item.message = '인스턴스 삭제됨'; ctx.fail++; renderBatchProgress(); return; }
    const filledPrompt = ctx.prompt.replace(/\{name\}/g, inst.name);

    item.status = 'creating'; renderBatchProgress();
    let taskId;
    try {
      const res = await manusCreate(filledPrompt, ctx.profile);
      taskId = res.taskId; item.taskId = taskId;
    } catch (e) {
      item.status = 'failed'; item.message = '생성 요청 실패: ' + e.message; ctx.fail++; renderBatchProgress(); return;
    }
    if (!taskId) { item.status = 'failed'; item.message = 'taskId 없음'; ctx.fail++; renderBatchProgress(); return; }

    item.status = 'running'; renderBatchProgress();
    let pollCount = 0;
    while (pollCount < BATCH_MAX_POLL) {
      if (ctx.cancelled) { item.status = 'skipped'; item.message = '사용자 취소'; renderBatchProgress(); return; }
      await sleep(BATCH_POLL_MS);
      pollCount++;
      let st;
      try { st = await manusStatus(taskId); }
      catch (e) { item.message = '상태 조회 실패: ' + e.message; renderBatchProgress(); continue; }
      const s = st.status || 'unknown';
      if (s === 'completed') {
        if (!st.fileUrl) { item.status = 'failed'; item.message = '결과 파일 없음'; ctx.fail++; renderBatchProgress(); return; }
        item.fileUrl = st.fileUrl;
        try {
          inst.slots = inst.slots || {};
          inst.slots[ctx.slotKey] = st.fileUrl;
          const saved = await saveInstance(inst);
          if (!saved) throw new Error('인스턴스 저장 실패');
          item.status = 'done';
          item.message = `완료${st.creditUsage ? ' · ' + st.creditUsage + ' credits' : ''}`;
          ctx.ok++;
        } catch (e) {
          item.status = 'failed'; item.message = '저장 실패: ' + e.message; ctx.fail++;
        }
        renderBatchProgress(); return;
      }
      if (s === 'failed') {
        item.status = 'failed'; item.message = '마누스 작업 실패'; ctx.fail++; renderBatchProgress(); return;
      }
      item.message = `상태: ${s} · 폴링 ${pollCount}/${BATCH_MAX_POLL}`;
      renderBatchProgress();
    }
    item.status = 'failed'; item.message = '시간 초과 (12분)'; ctx.fail++; renderBatchProgress();
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function renderBatchProgress() {
    if (!batchGenCtx) return;
    const ctx = batchGenCtx;
    const done = ctx.items.filter(i => i.status === 'done' || i.status === 'failed' || i.status === 'skipped').length;
    document.getElementById('bgDone').textContent = done;
    document.getElementById('bgTotalRunning').textContent = ctx.items.length;
    document.getElementById('bgOk').textContent = ctx.ok;
    document.getElementById('bgFail').textContent = ctx.fail;
    const list = document.getElementById('bgProgressList');
    list.innerHTML = '';
    ctx.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'bg-prog-row bg-prog-' + item.status;
      const statusIcon = ({pending:'⏸',creating:'🚀',running:'⏳',done:'✅',failed:'❌',skipped:'⏭'})[item.status] || '·';
      row.innerHTML = `
        <span class="bg-prog-icon">${statusIcon}</span>
        <span class="bg-prog-name">${escapeHtml(item.name)}</span>
        <span class="bg-prog-msg">${escapeHtml(item.message || statusLabelKr(item.status))}</span>
        ${item.fileUrl ? `<a href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener" class="bg-prog-link" title="새 창에서 보기">↗</a>` : ''}
      `;
      list.appendChild(row);
    });
  }
  function statusLabelKr(s) {
    return ({pending:'대기',creating:'요청 중',running:'생성 중',done:'완료',failed:'실패',skipped:'건너뜀'})[s] || s;
  }
  function cancelBatchGen() {
    if (batchGenCtx && batchGenCtx.running) {
      if (!confirm('진행 중인 일괄 생성을 취소할까요? 이미 시작된 작업은 마누스에서 계속 실행되고 크레딧은 사용됩니다.')) return false;
      batchGenCtx.cancelled = true;
      toast('취소 요청됨 — 진행 중인 항목 마무리 후 종료', 'info');
    }
    return true;
  }

  // -------- 자료로 자동채우기 (Step E) --------
  // Claude 프록시 워커 설정 (Firestore: app-config/claudeProxy) — defect-diagnosis와 공유
  let claudeProxyConfig = null;
  async function loadClaudeProxyConfig() {
    if (!firebaseReady || !db) return null;
    try {
      const doc = await db.collection('app-config').doc('claudeProxy').get();
      claudeProxyConfig = doc.exists ? doc.data() : null;
      return claudeProxyConfig;
    } catch (e) {
      console.error('[claude-proxy] config 로드 실패:', e);
      return null;
    }
  }
  async function saveClaudeProxyConfig(cfg) {
    if (!firebaseReady || !db) { toast('오프라인 — 저장 불가', 'error'); return false; }
    try {
      await db.collection('app-config').doc('claudeProxy').set({
        workerUrl: cfg.workerUrl || '',
        workerSecret: cfg.workerSecret || '',
        claudeApiKey: cfg.claudeApiKey || '',
        updatedAt: nowIso(),
      }, { merge: true });
      claudeProxyConfig = cfg;
      return true;
    } catch (e) {
      console.error('[claude-proxy] config 저장 실패:', e);
      toast('저장 실패: ' + (e.code || e.message), 'error');
      return false;
    }
  }
  async function openClaudeConfigModal() {
    await loadClaudeProxyConfig();
    document.getElementById('ccUrl').value = (claudeProxyConfig && claudeProxyConfig.workerUrl) || '';
    document.getElementById('ccSecret').value = (claudeProxyConfig && claudeProxyConfig.workerSecret) || '';
    document.getElementById('ccApiKey').value = (claudeProxyConfig && claudeProxyConfig.claudeApiKey) || '';
    openModal('claudeConfigModal');
  }
  async function saveClaudeConfigEditor() {
    const url = document.getElementById('ccUrl').value.trim();
    const secret = document.getElementById('ccSecret').value.trim();
    const apiKey = document.getElementById('ccApiKey').value.trim();
    if (!url || !secret) { toast('URL과 시크릿을 입력하세요.', 'error'); return; }
    if (!/^https?:\/\//.test(url)) { toast('URL은 http(s)://로 시작해야 합니다.', 'error'); return; }
    if (apiKey && !/^sk-ant-/i.test(apiKey)) {
      if (!confirm('Anthropic API 키 형식이 sk-ant-로 시작하지 않습니다. 그래도 저장할까요?')) return;
    }
    const ok = await saveClaudeProxyConfig({ workerUrl: url.replace(/\/$/, ''), workerSecret: secret, claudeApiKey: apiKey });
    if (ok) {
      closeModal('claudeConfigModal');
      toast('Claude 설정 저장됨', 'success');
      if (document.body.getAttribute('data-mode') === 'product') refreshProductDashboard();
    }
  }
  async function testClaudeConfig() {
    const url = document.getElementById('ccUrl').value.trim().replace(/\/$/, '');
    const secret = document.getElementById('ccSecret').value.trim();
    if (!url || !secret) { toast('URL과 시크릿 모두 입력 후 테스트하세요.', 'error'); return; }
    toast('연결 테스트 중...', 'info');
    try {
      // /fetch-url 으로 가벼운 테스트 (URL 누락 → 400 정상 응답이면 시크릿 통과)
      const r = await fetch(url + '/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': secret },
        body: JSON.stringify({}),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) { toast('❌ 시크릿이 워커와 일치하지 않습니다.', 'error'); return; }
      if (r.status === 400) { toast('✅ 워커 연결 OK (시크릿 검증 통과)', 'success'); return; }
      if (r.ok) { toast('✅ 워커 연결 OK', 'success'); return; }
      toast(`연결됨 — HTTP ${r.status}: ${data.error || '응답 확인 필요'}`, 'info');
    } catch (e) {
      toast('연결 실패: ' + e.message, 'error');
    }
  }

  // 자동채우기 상태
  let autoFillCtx = null; // { ownPdfs:[{name,size,base64}], refPdfs:[...], stage:'input'|'result', suggestions:{...} }

  function resetAutoFillCtx() {
    autoFillCtx = { ownPdfs: [], refPdfs: [], suggestions: null, summary: '', selected: new Set() };
  }

  async function openAutoFillModal() {
    if (!instanceEditorCtx) { toast('인스턴스 편집기에서만 열 수 있습니다.', 'error'); return; }
    const tpl = findTemplate(instanceEditorCtx.templateId);
    if (!tpl || !(tpl.slots || []).length) { toast('템플릿에 슬롯이 없습니다.', 'error'); return; }
    await loadClaudeProxyConfig();
    resetAutoFillCtx();
    // UI 초기화
    document.getElementById('afOwnText').value = '';
    document.getElementById('afRefText').value = '';
    document.getElementById('afRefUrls').value = '';
    document.getElementById('afOwnFiles').innerHTML = '';
    document.getElementById('afRefFiles').innerHTML = '';
    document.getElementById('afOwnFile').value = '';
    document.getElementById('afRefFile').value = '';
    showAutoFillStage('input');
    // 워커 설정 + Anthropic 키 경고
    const hasCfg = !!(claudeProxyConfig && claudeProxyConfig.workerUrl && claudeProxyConfig.workerSecret && claudeProxyConfig.claudeApiKey);
    document.getElementById('afWarnConfig').style.display = hasCfg ? 'none' : 'block';
    document.getElementById('afRun').disabled = !hasCfg;
    openModal('autoFillModal');
  }

  function showAutoFillStage(stage) {
    const isInput = stage === 'input';
    document.getElementById('afInputStage').style.display = isInput ? '' : 'none';
    document.getElementById('afResultStage').style.display = isInput ? 'none' : '';
    document.getElementById('afRun').style.display = isInput ? '' : 'none';
    document.getElementById('afApply').style.display = isInput ? 'none' : '';
    document.getElementById('afBack').style.display = isInput ? 'none' : '';
    document.getElementById('afFootHint').textContent = isInput
      ? '우리 자료는 사실 추출, 타사 자료는 톤 참고만 사용됩니다.'
      : '체크된 항목만 슬롯에 적용됩니다 — 적용 후에도 직접 편집 가능';
  }

  function fmtBytes(n) {
    if (!n) return '';
    if (n < 1024) return n + 'B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB';
    return (n / (1024 * 1024)).toFixed(1) + 'MB';
  }
  function readPdfAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = reader.result;
        const idx = s.indexOf(',');
        resolve(idx >= 0 ? s.substring(idx + 1) : s);
      };
      reader.onerror = () => reject(new Error('PDF 읽기 실패'));
      reader.readAsDataURL(file);
    });
  }
  async function addAutoFillPdf(role, file) {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast('PDF 파일만 가능합니다', 'error'); return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast('PDF가 너무 큽니다 (최대 30MB)', 'error'); return;
    }
    try {
      const base64 = await readPdfAsBase64(file);
      const list = role === 'own' ? autoFillCtx.ownPdfs : autoFillCtx.refPdfs;
      list.push({ name: file.name, size: file.size, base64 });
      renderAutoFillFiles(role);
    } catch (e) {
      console.error('[auto-fill] PDF 읽기 실패:', e);
      toast('PDF 읽기 실패: ' + e.message, 'error');
    }
  }
  function renderAutoFillFiles(role) {
    const wrap = document.getElementById(role === 'own' ? 'afOwnFiles' : 'afRefFiles');
    const list = role === 'own' ? autoFillCtx.ownPdfs : autoFillCtx.refPdfs;
    wrap.innerHTML = '';
    list.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'af-file';
      row.innerHTML = `
        <span class="af-file-icon">📄</span>
        <span class="af-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="af-file-size">${fmtBytes(f.size)}</span>
        <button type="button" class="af-file-rm" aria-label="제거">×</button>
      `;
      row.querySelector('.af-file-rm').addEventListener('click', () => {
        list.splice(idx, 1);
        renderAutoFillFiles(role);
      });
      wrap.appendChild(row);
    });
  }

  function wireAutoFillDrop(dropId, fileInputId, pickBtnId, role) {
    const drop = document.getElementById(dropId);
    const fileInput = document.getElementById(fileInputId);
    const pickBtn = document.getElementById(pickBtnId);
    if (!drop || !fileInput) return;
    const open = () => fileInput.click();
    drop.addEventListener('click', e => { if (e.target !== pickBtn) open(); });
    if (pickBtn) pickBtn.addEventListener('click', e => { e.stopPropagation(); open(); });
    drop.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', async e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      const files = (e.dataTransfer && e.dataTransfer.files) || [];
      for (const f of files) await addAutoFillPdf(role, f);
    });
    fileInput.addEventListener('change', async e => {
      const files = e.target.files || [];
      for (const f of files) await addAutoFillPdf(role, f);
      e.target.value = '';
    });
  }

  async function fetchUrlViaWorker(url) {
    if (!claudeProxyConfig || !claudeProxyConfig.workerUrl || !claudeProxyConfig.workerSecret) {
      throw new Error('Claude 워커 설정 없음');
    }
    const r = await fetch(claudeProxyConfig.workerUrl.replace(/\/$/, '') + '/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': claudeProxyConfig.workerSecret },
      body: JSON.stringify({ url }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data; // { text, title, url }
  }

  function buildAutoFillSystem() {
    return [
      '당신은 한국어 제품 상세페이지 슬롯 자동 채우기 전문가입니다.',
      '두 종류의 자료를 받아 슬롯 정의에 맞는 값을 추출/작성하세요.',
      '',
      '【자료 종류】',
      'A. 우리 제품 자료 (PDF / 텍스트) — 우리 제품의 사실(제품명·용량·수치·특징·효과·인증 등)을 추출하는 출처. 모든 구체적 사실은 반드시 이 자료에서만 가져옵니다.',
      'B. 타사 참고 자료 (URL 본문 / PDF / 텍스트) — 헤드라인 톤, 섹션 구성, USP 프레이밍, 카피 패턴 참고용.',
      '',
      '【엄격 규칙】',
      '1. 우리 제품 자료에서 확인되지 않는 사실(제품명·수치·인증·성능·가격·용량 등)은 절대 만들어내지 마세요. 없으면 value=null.',
      '2. 타사 자료의 제품명·회사명·고유 수치·인증명·사진 캡션·고유 카피는 절대 그대로 인용 금지. 영감 받은 부분은 우리 제품에 맞게 자연스러운 한국어로 재작성하세요 (표절 방지).',
      '3. 이미지 슬롯(image type)은 자료에서 직접 URL을 추출하지 못하면 value=null.',
      '4. 한국어 어법으로 자연스럽게, 광고 톤 과장은 피하고 사실 기반.',
      '5. 슬롯 type에 맞게 작성: text=한 줄(20자 내외), textarea=2~5문장, link=URL, image=이미지 URL.',
      '',
      '【출력 형식】',
      '반드시 아래 JSON만 응답하세요. JSON 외 어떤 텍스트도 포함하지 마세요. ```json 코드펜스 사용 금지.',
      '{',
      '  "slots": {',
      '    "<slotKey>": {',
      '      "value": "<문자열 또는 null>",',
      '      "kind": "own | rewrite | ref | none",',
      '      "source": "<우리 자료 위치(예: PDF p.3) 또는 \'재작성\' 또는 null>",',
      '      "reference": "<타사 참고 부분 또는 null>",',
      '      "confidence": <0~1 사이 숫자>',
      '    }',
      '  },',
      '  "summary": "<1~2문장 분석 요약>"',
      '}',
      '',
      'kind 의미: own=우리 자료에서 그대로 추출 / rewrite=타사 톤 참고하되 우리 사실로 재작성 / ref=타사 구조에서 영감 / none=값 없음(null)',
    ].join('\n');
  }

  function buildAutoFillUserContent(slots, ownText, refText, refUrlPages, ownPdfs, refPdfs) {
    const blocks = [];
    // 1) 슬롯 정의
    const slotDefs = slots.map(s => ({
      key: s.key,
      type: s.type,
      label: s.label || s.key,
      defaultValue: s.defaultValue || '',
    }));
    blocks.push({
      type: 'text',
      text: '【슬롯 정의】 — 이 키들에 대해서만 값을 채우세요. 모르는 키는 응답에서 빼도 됩니다.\n' + JSON.stringify(slotDefs, null, 2),
    });
    // 2) 우리 자료 (PDF + 텍스트)
    ownPdfs.forEach((p, i) => {
      blocks.push({
        type: 'text',
        text: `【우리 제품 자료 PDF #${i + 1}】 파일명: ${p.name} — 사실 추출 출처`,
      });
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: p.base64 },
        cache_control: { type: 'ephemeral' },
      });
    });
    if (ownText && ownText.trim()) {
      blocks.push({
        type: 'text',
        text: '【우리 제품 자료 텍스트】 — 사실 추출 출처\n\n' + ownText.trim(),
      });
    }
    // 3) 타사 참고 자료
    refUrlPages.forEach((p, i) => {
      const head = `【타사 참고 URL #${i + 1}】 출처: ${p.url}${p.title ? ` (제목: ${p.title})` : ''} — 구조·카피 톤만 참고, 사실 그대로 인용 금지`;
      blocks.push({ type: 'text', text: head + '\n\n' + p.text });
    });
    refPdfs.forEach((p, i) => {
      blocks.push({
        type: 'text',
        text: `【타사 참고 PDF #${i + 1}】 파일명: ${p.name} — 구조·카피 톤만 참고, 사실 그대로 인용 금지`,
      });
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: p.base64 },
        cache_control: { type: 'ephemeral' },
      });
    });
    if (refText && refText.trim()) {
      blocks.push({
        type: 'text',
        text: '【타사 참고 텍스트】 — 구조·카피 톤만 참고, 사실 그대로 인용 금지\n\n' + refText.trim(),
      });
    }
    // 4) 응답 요청
    blocks.push({
      type: 'text',
      text: '위 자료를 분석해 슬롯 정의의 모든 키에 대해 JSON으로만 응답하세요. 우리 자료에 없는 사실은 value=null로.',
    });
    return blocks;
  }

  async function callClaudeAutoFill(systemPrompt, content) {
    if (!claudeProxyConfig || !claudeProxyConfig.workerUrl || !claudeProxyConfig.workerSecret) {
      throw new Error('Claude 워커 설정 없음');
    }
    if (!claudeProxyConfig.claudeApiKey) {
      throw new Error('Anthropic API 키가 설정되지 않았습니다. ⚙ Claude 자동채우기 설정에서 입력하세요.');
    }
    const r = await fetch(claudeProxyConfig.workerUrl.replace(/\/$/, ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': claudeProxyConfig.workerSecret },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
        claudeApiKey: claudeProxyConfig.claudeApiKey,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  function extractClaudeJson(claudeResp) {
    const out = (claudeResp && claudeResp.content) || [];
    let text = '';
    for (const c of out) {
      if (c.type === 'text' && typeof c.text === 'string') text += c.text;
    }
    text = text.trim();
    // 코드펜스 제거
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    // 첫 { 부터 마지막 } 까지만 추출
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) throw new Error('JSON 응답을 찾을 수 없음');
    const jsonStr = text.substring(first, last + 1);
    return JSON.parse(jsonStr);
  }

  async function runAutoFill() {
    if (!autoFillCtx) return;
    const tpl = findTemplate(instanceEditorCtx.templateId);
    if (!tpl) { toast('템플릿이 없습니다.', 'error'); return; }
    const slots = tpl.slots || [];
    const ownText = document.getElementById('afOwnText').value;
    const refText = document.getElementById('afRefText').value;
    const refUrlsRaw = document.getElementById('afRefUrls').value;
    const refUrls = refUrlsRaw.split('\n').map(s => s.trim()).filter(s => /^https?:\/\//.test(s)).slice(0, 3);
    const hasOwn = autoFillCtx.ownPdfs.length > 0 || (ownText && ownText.trim().length > 0);
    if (!hasOwn) {
      toast('A. 우리 제품 자료를 1개 이상 넣어주세요 (PDF 또는 텍스트).', 'error'); return;
    }
    if (!claudeProxyConfig || !claudeProxyConfig.workerUrl) {
      toast('Claude 자동채우기 설정이 필요합니다.', 'error'); return;
    }

    showAutoFillStage('result');
    const status = document.getElementById('afStatus');
    const summaryEl = document.getElementById('afSummary');
    const listEl = document.getElementById('afSuggestList');
    summaryEl.style.display = 'none';
    listEl.innerHTML = '';

    try {
      // 1) URL 본문 가져오기
      const urlPages = [];
      for (let i = 0; i < refUrls.length; i++) {
        status.className = 'af-status af-status-running';
        status.textContent = `🔗 타사 URL 본문 가져오는 중... (${i + 1}/${refUrls.length})`;
        try {
          const res = await fetchUrlViaWorker(refUrls[i]);
          if (res && res.text) urlPages.push({ url: res.url || refUrls[i], title: res.title || '', text: res.text });
        } catch (e) {
          console.warn('[auto-fill] URL fetch 실패:', refUrls[i], e.message);
          urlPages.push({ url: refUrls[i], title: '', text: `[가져오기 실패: ${e.message}]` });
        }
      }

      // 2) Claude 호출
      status.className = 'af-status af-status-running';
      status.textContent = '🤖 Claude로 자료 분석 중... (30초~2분 소요)';
      const system = buildAutoFillSystem();
      const content = buildAutoFillUserContent(slots, ownText, refText, urlPages, autoFillCtx.ownPdfs, autoFillCtx.refPdfs);
      const resp = await callClaudeAutoFill(system, content);
      const usage = resp.usage || {};
      const json = extractClaudeJson(resp);
      autoFillCtx.suggestions = json.slots || {};
      autoFillCtx.summary = json.summary || '';
      autoFillCtx.selected = new Set();
      // 값 있는 것 기본 선택
      Object.keys(autoFillCtx.suggestions).forEach(k => {
        const v = autoFillCtx.suggestions[k];
        if (v && v.value !== null && v.value !== undefined && String(v.value).trim() !== '') {
          autoFillCtx.selected.add(k);
        }
      });

      const tokenInfo = usage.input_tokens
        ? ` · 토큰 ${usage.input_tokens || 0} in / ${usage.output_tokens || 0} out${usage.cache_creation_input_tokens ? ` (캐시 생성 ${usage.cache_creation_input_tokens})` : ''}`
        : '';
      status.className = 'af-status af-status-ok';
      status.textContent = `✅ 분석 완료${tokenInfo}`;
      if (autoFillCtx.summary) {
        summaryEl.style.display = '';
        summaryEl.innerHTML = '📌 <b>분석 요약:</b> ' + escapeHtml(autoFillCtx.summary);
      }
      renderAutoFillSuggestions(slots);
    } catch (e) {
      console.error('[auto-fill] 실패:', e);
      status.className = 'af-status af-status-error';
      status.textContent = '❌ 분석 실패: ' + (e.message || '알 수 없는 오류');
    }
  }

  function kindLabel(kind) {
    if (kind === 'own') return { txt: '우리 자료', cls: 'af-suggest-tag-own' };
    if (kind === 'rewrite') return { txt: '재작성', cls: 'af-suggest-tag-rewrite' };
    if (kind === 'ref') return { txt: '타사 영감', cls: 'af-suggest-tag-ref' };
    return null;
  }

  function renderAutoFillSuggestions(slots) {
    const listEl = document.getElementById('afSuggestList');
    listEl.innerHTML = '';
    const sug = autoFillCtx.suggestions || {};
    const curSlots = (instanceEditorCtx && instanceEditorCtx.slots) || {};
    slots.forEach(s => {
      const v = sug[s.key];
      const has = v && v.value !== null && v.value !== undefined && String(v.value).trim() !== '';
      const cur = curSlots[s.key];
      const checked = autoFillCtx.selected.has(s.key);
      const kl = v ? kindLabel(v.kind) : null;
      const conf = (v && typeof v.confidence === 'number') ? Math.round(v.confidence * 100) + '%' : null;
      const row = document.createElement('label');
      row.className = 'af-suggest';
      row.innerHTML = `
        <input type="checkbox" data-key="${escapeHtml(s.key)}" ${checked ? 'checked' : ''} ${has ? '' : 'disabled'} />
        <div class="af-suggest-meta">
          <div class="af-suggest-head">
            <span class="af-suggest-key">${escapeHtml(s.label || s.key)}</span>
            <span class="af-suggest-tag af-suggest-tag-conf" title="슬롯 키">${escapeHtml(s.key)} · ${escapeHtml(s.type)}</span>
            ${kl ? `<span class="af-suggest-tag ${kl.cls}">${kl.txt}</span>` : ''}
            ${conf ? `<span class="af-suggest-tag af-suggest-tag-conf">신뢰도 ${conf}</span>` : ''}
          </div>
          ${cur ? `<div class="af-suggest-cur"><b>현재 값:</b> ${escapeHtml(String(cur).slice(0, 120))}${String(cur).length > 120 ? '...' : ''}</div>` : ''}
          <div class="af-suggest-val ${has ? '' : 'af-suggest-empty'}">${has ? escapeHtml(String(v.value)) : '(추출 결과 없음 — 자료에서 확인되지 않은 값)'}</div>
          ${v && (v.source || v.reference) ? `<div class="af-suggest-source">${v.source ? `<b>출처:</b> ${escapeHtml(v.source)}` : ''}${v.source && v.reference ? ' · ' : ''}${v.reference ? `<b>참고:</b> ${escapeHtml(v.reference)}` : ''}</div>` : ''}
        </div>
      `;
      const cb = row.querySelector('input[type=checkbox]');
      cb.addEventListener('change', () => {
        if (cb.checked) autoFillCtx.selected.add(s.key);
        else autoFillCtx.selected.delete(s.key);
        updateAutoFillSelCount(slots);
        // 시각적 강조
        row.classList.toggle('af-selected', cb.checked);
      });
      listEl.appendChild(row);
    });
    updateAutoFillSelCount(slots);
  }

  function updateAutoFillSelCount(slots) {
    const eligible = slots.filter(s => {
      const v = autoFillCtx.suggestions && autoFillCtx.suggestions[s.key];
      return v && v.value !== null && v.value !== undefined && String(v.value).trim() !== '';
    }).length;
    document.getElementById('afSelCount').textContent = `${autoFillCtx.selected.size} / ${eligible} 선택`;
  }

  function autoFillSelectAll(mode) {
    if (!autoFillCtx || !autoFillCtx.suggestions) return;
    const tpl = findTemplate(instanceEditorCtx.templateId);
    const slots = tpl ? (tpl.slots || []) : [];
    autoFillCtx.selected = new Set();
    slots.forEach(s => {
      const v = autoFillCtx.suggestions[s.key];
      const has = v && v.value !== null && v.value !== undefined && String(v.value).trim() !== '';
      if (mode === 'all' && has) autoFillCtx.selected.add(s.key);
      else if (mode === 'filled' && has) autoFillCtx.selected.add(s.key);
      // mode === 'none' → 빈 셋 유지
    });
    renderAutoFillSuggestions(slots);
  }

  function applyAutoFillSelected() {
    if (!autoFillCtx || !autoFillCtx.suggestions) return;
    if (!instanceEditorCtx) return;
    const sug = autoFillCtx.suggestions;
    let applied = 0;
    instanceEditorCtx.slots = instanceEditorCtx.slots || {};
    autoFillCtx.selected.forEach(key => {
      const v = sug[key];
      if (v && v.value !== null && v.value !== undefined) {
        instanceEditorCtx.slots[key] = String(v.value);
        applied++;
      }
    });
    if (applied === 0) { toast('적용할 항목이 없습니다.', 'info'); return; }
    closeModal('autoFillModal');
    renderInstanceSlots();
    refreshInstancePreview();
    toast(`${applied}개 슬롯에 적용됨`, 'success');
  }

  // -------- 자료로 일괄 생성 (Step F) --------
  let batchAutoFillCtx = null;
  const BAF_CONCURRENCY = 2;

  async function openBatchAutoFillModal() {
    await loadClaudeProxyConfig();
    const hasCfg = !!(claudeProxyConfig && claudeProxyConfig.workerUrl && claudeProxyConfig.workerSecret && claudeProxyConfig.claudeApiKey);
    document.getElementById('bafWarnConfig').style.display = hasCfg ? 'none' : 'block';
    document.getElementById('bafConfigStage').style.display = '';
    document.getElementById('bafProgressStage').style.display = 'none';
    document.getElementById('bafStart').style.display = '';
    document.getElementById('bafStart').disabled = !hasCfg;

    // 템플릿 셀렉트 채우기
    const sel = document.getElementById('bafTemplate');
    sel.innerHTML = '';
    (state.templates || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `📐 ${t.name} (슬롯 ${(t.slots || []).length}개)`;
      sel.appendChild(opt);
    });
    if (sel.options.length === 0) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— 등록된 템플릿 없음 —'; opt.disabled = true;
      sel.appendChild(opt);
      document.getElementById('bafStart').disabled = true;
    }

    // 입력 초기화
    batchAutoFillCtx = { ownPdfs: [], refPdfs: [], items: [], running: false, cancelled: false, ok: 0, fail: 0 };
    document.getElementById('bafNamePattern').value = '{filename}';
    document.getElementById('bafRefUrls').value = '';
    document.getElementById('bafRefText').value = '';
    document.getElementById('bafOwnFiles').innerHTML = '';
    document.getElementById('bafRefFiles').innerHTML = '';
    document.getElementById('bafOwnFile').value = '';
    document.getElementById('bafRefFile').value = '';
    openModal('batchAutoFillModal');
  }

  async function addBatchAutoFillPdf(role, file) {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast('PDF 파일만 가능합니다', 'error'); return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast('PDF가 너무 큽니다 (최대 30MB)', 'error'); return;
    }
    try {
      const base64 = await readPdfAsBase64(file);
      const list = role === 'own' ? batchAutoFillCtx.ownPdfs : batchAutoFillCtx.refPdfs;
      list.push({ name: file.name, size: file.size, base64 });
      renderBatchAutoFillFiles(role);
    } catch (e) {
      console.error('[batch-auto-fill] PDF 읽기 실패:', e);
      toast('PDF 읽기 실패: ' + e.message, 'error');
    }
  }

  function renderBatchAutoFillFiles(role) {
    const wrap = document.getElementById(role === 'own' ? 'bafOwnFiles' : 'bafRefFiles');
    const list = role === 'own' ? batchAutoFillCtx.ownPdfs : batchAutoFillCtx.refPdfs;
    wrap.innerHTML = '';
    list.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'af-file';
      row.innerHTML = `
        <span class="af-file-icon">📄</span>
        <span class="af-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="af-file-size">${fmtBytes(f.size)}</span>
        <button type="button" class="af-file-rm" aria-label="제거">×</button>
      `;
      row.querySelector('.af-file-rm').addEventListener('click', () => {
        list.splice(idx, 1);
        renderBatchAutoFillFiles(role);
      });
      wrap.appendChild(row);
    });
  }

  function wireBatchAutoFillDrop(dropId, fileInputId, pickBtnId, role) {
    const drop = document.getElementById(dropId);
    const fileInput = document.getElementById(fileInputId);
    const pickBtn = document.getElementById(pickBtnId);
    if (!drop || !fileInput) return;
    const open = () => fileInput.click();
    drop.addEventListener('click', e => { if (e.target !== pickBtn) open(); });
    if (pickBtn) pickBtn.addEventListener('click', e => { e.stopPropagation(); open(); });
    drop.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', async e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      const files = (e.dataTransfer && e.dataTransfer.files) || [];
      for (const f of files) await addBatchAutoFillPdf(role, f);
    });
    fileInput.addEventListener('change', async e => {
      const files = e.target.files || [];
      for (const f of files) await addBatchAutoFillPdf(role, f);
      e.target.value = '';
    });
  }

  function buildBatchAutoFillNameFromPattern(pattern, filename, n) {
    const baseName = filename.replace(/\.pdf$/i, '');
    return (pattern || '{filename}')
      .replace(/\{filename\}/g, baseName)
      .replace(/\{n\}/g, String(n))
      .trim() || baseName;
  }

  async function startBatchAutoFill() {
    if (!batchAutoFillCtx) return;
    if (batchAutoFillCtx.ownPdfs.length === 0) {
      toast('우리 제품 PDF를 1개 이상 추가하세요.', 'error'); return;
    }
    if (!claudeProxyConfig || !claudeProxyConfig.workerUrl) {
      toast('Claude 자동채우기 설정이 필요합니다.', 'error'); return;
    }
    const tplId = document.getElementById('bafTemplate').value;
    const tpl = findTemplate(tplId);
    if (!tpl || !(tpl.slots || []).length) { toast('템플릿이 유효하지 않거나 슬롯이 없습니다.', 'error'); return; }

    const namePattern = document.getElementById('bafNamePattern').value.trim() || '{filename}';
    const refText = document.getElementById('bafRefText').value;
    const refUrlsRaw = document.getElementById('bafRefUrls').value;
    const refUrls = refUrlsRaw.split('\n').map(s => s.trim()).filter(s => /^https?:\/\//.test(s)).slice(0, 3);

    if (!confirm(`${batchAutoFillCtx.ownPdfs.length}개 PDF로 인스턴스를 일괄 생성합니다.\n예상 시간: 약 ${batchAutoFillCtx.ownPdfs.length * 60}초\n진행할까요?`)) return;

    // 공통 타사 자료 — URL 한 번만 fetch (모든 인스턴스에서 재사용)
    document.getElementById('bafConfigStage').style.display = 'none';
    document.getElementById('bafProgressStage').style.display = '';
    document.getElementById('bafStart').style.display = 'none';

    const items = batchAutoFillCtx.ownPdfs.map((p, idx) => ({
      pdf: p,
      idx,
      name: buildBatchAutoFillNameFromPattern(namePattern, p.name, idx + 1),
      status: 'pending',
      message: '',
      instanceId: null,
    }));
    batchAutoFillCtx.items = items;
    batchAutoFillCtx.running = true;
    batchAutoFillCtx.cancelled = false;
    batchAutoFillCtx.ok = 0;
    batchAutoFillCtx.fail = 0;
    batchAutoFillCtx.tpl = tpl;
    batchAutoFillCtx.refText = refText;
    batchAutoFillCtx.refPdfs = batchAutoFillCtx.refPdfs || [];

    // URL 본문 — 1회 가져오기
    batchAutoFillCtx.urlPages = [];
    for (let i = 0; i < refUrls.length; i++) {
      try {
        const res = await fetchUrlViaWorker(refUrls[i]);
        if (res && res.text) batchAutoFillCtx.urlPages.push({ url: res.url || refUrls[i], title: res.title || '', text: res.text });
      } catch (e) {
        console.warn('[batch-auto-fill] URL fetch 실패:', refUrls[i], e.message);
        batchAutoFillCtx.urlPages.push({ url: refUrls[i], title: '', text: `[가져오기 실패: ${e.message}]` });
      }
    }

    renderBatchAutoFillProgress();

    // 동시성 풀 실행
    let nextIdx = 0;
    const workers = [];
    for (let i = 0; i < BAF_CONCURRENCY; i++) {
      workers.push((async () => {
        while (true) {
          if (batchAutoFillCtx.cancelled) return;
          const idx = nextIdx++;
          if (idx >= items.length) return;
          await processBatchAutoFillItem(idx);
        }
      })());
    }
    await Promise.all(workers);

    batchAutoFillCtx.running = false;
    renderBatchAutoFillProgress();
    renderInstanceList();
    toast(`완료 — 성공 ${batchAutoFillCtx.ok}건 / 실패 ${batchAutoFillCtx.fail}건`,
      batchAutoFillCtx.fail === 0 ? 'success' : 'info');
  }

  async function processBatchAutoFillItem(idx) {
    const ctx = batchAutoFillCtx;
    const item = ctx.items[idx];
    item.status = 'running'; item.message = 'Claude 분석 중...';
    renderBatchAutoFillProgress();
    try {
      const slots = ctx.tpl.slots || [];
      const content = buildAutoFillUserContent(slots, '', ctx.refText, ctx.urlPages, [item.pdf], ctx.refPdfs);
      const system = buildAutoFillSystem();
      const resp = await callClaudeAutoFill(system, content);
      const json = extractClaudeJson(resp);
      const sug = json.slots || {};
      // 인스턴스 생성
      const newInst = {
        id: 'inst-' + Math.random().toString(36).slice(2, 10),
        templateId: ctx.tpl.id,
        name: item.name,
        slots: {},
      };
      slots.forEach(s => {
        const v = sug[s.key];
        if (v && v.value !== null && v.value !== undefined && String(v.value).trim() !== '') {
          newInst.slots[s.key] = String(v.value);
        }
      });
      const saved = await saveInstance(newInst);
      if (!saved) throw new Error('저장 실패');
      item.instanceId = newInst.id;
      const filledCount = Object.keys(newInst.slots).length;
      item.status = 'done';
      item.message = `완료 · ${filledCount}/${slots.length}개 슬롯 채움`;
      ctx.ok++;
    } catch (e) {
      console.error('[batch-auto-fill] 항목 실패:', e);
      item.status = 'failed';
      item.message = '실패: ' + (e.message || '알 수 없는 오류');
      ctx.fail++;
    }
    renderBatchAutoFillProgress();
  }

  function renderBatchAutoFillProgress() {
    const ctx = batchAutoFillCtx;
    if (!ctx) return;
    const done = ctx.items.filter(i => i.status === 'done' || i.status === 'failed').length;
    document.getElementById('bafDone').textContent = done;
    document.getElementById('bafTotalRunning').textContent = ctx.items.length;
    document.getElementById('bafOk').textContent = ctx.ok;
    document.getElementById('bafFail').textContent = ctx.fail;
    const list = document.getElementById('bafProgressList');
    list.innerHTML = '';
    ctx.items.forEach(item => {
      const row = document.createElement('div');
      const statusClass = ({pending:'pending',running:'running',done:'done',failed:'failed'})[item.status] || 'pending';
      row.className = 'bg-prog-row bg-prog-' + statusClass;
      const icon = ({pending:'⏸',running:'⏳',done:'✅',failed:'❌'})[item.status] || '·';
      row.innerHTML = `
        <span class="bg-prog-icon">${icon}</span>
        <span class="bg-prog-name">${escapeHtml(item.name)}</span>
        <span class="bg-prog-msg">${escapeHtml(item.message || '')}</span>
        ${item.instanceId ? '<span style="font-size:11px; color:var(--muted);">📄 생성됨</span>' : ''}
      `;
      list.appendChild(row);
    });
  }

  function cancelBatchAutoFill() {
    if (batchAutoFillCtx && batchAutoFillCtx.running) {
      if (!confirm('진행 중인 일괄 생성을 취소할까요? 완료된 인스턴스는 유지됩니다.')) return false;
      batchAutoFillCtx.cancelled = true;
      toast('취소 요청됨 — 진행 중인 항목 마무리 후 종료', 'info');
    }
    return true;
  }

  // -------- modal helpers --------
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  // -------- toast --------
  let toastTimer = null;
  function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (type || 'info');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2200);
  }

  // -------- export / reset --------
  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pourstore-renewal-builder-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    toast('JSON 다운로드 완료', 'success');
  }
  function shareJson() {
    const data = JSON.stringify(state, null, 2);
    const filename = `pourstore-renewal-builder-${new Date().toISOString().slice(0,10)}.json`;
    // 1) iOS/Android: Web Share API로 파일 공유 (카톡·메일 선택 가능)
    try {
      const file = new File([data], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({
          files: [file],
          title: 'POUR스토어 빌더 백업',
          text: 'POUR스토어 자사몰 리뉴얼 — 페이지 관리 데이터 백업',
        })
          .then(() => toast('공유 완료', 'success'))
          .catch(err => {
            if (err && err.name === 'AbortError') return; // 사용자가 취소한 경우 무시
            console.error('[share] 실패:', err);
            // 파일 공유 실패 시 텍스트 복사로 폴백
            copyJsonToClipboard(data);
          });
        return;
      }
    } catch (e) { console.warn('[share] 파일 객체 생성 실패:', e); }
    // 2) 클립보드 복사로 폴백 (PC 브라우저, 일부 안드로이드)
    copyJsonToClipboard(data);
  }
  function copyJsonToClipboard(data) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data)
        .then(() => toast('JSON이 클립보드에 복사됐어요. 카톡에 붙여넣으세요. (' + data.length.toLocaleString() + '자)', 'success'))
        .catch(() => { exportJson(); toast('클립보드 실패 → 다운로드로 대체', 'info'); });
    } else {
      exportJson();
      toast('이 환경에선 공유 미지원 → 다운로드로 대체', 'info');
    }
  }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.pages)) throw new Error('형식 오류');
        if (!confirm('현재 빌더 데이터를 가져온 파일로 덮어쓸까요?')) return;
        const merged = Object.assign({ history: {}, activePageId: obj.pages[0].id }, obj);
        state = migrate(merged);
        addMissingDefaultPages(state);
        saveState(); renderAll();
        toast('가져오기 완료', 'success');
      } catch (e) {
        toast('가져오기 실패: ' + e.message, 'error');
      }
    };
    reader.readAsText(file);
  }
  function resetAll() {
    if (!confirm('모든 페이지·섹션·이력을 초기 상태로 되돌릴까요?')) return;
    state = freshState();
    saveState(); renderAll();
    toast('초기화 완료', 'info');
  }

  // -------- bindings --------
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnAddPage').addEventListener('click', addPage);
    document.getElementById('btnAddFolder').addEventListener('click', addFolder);
    document.getElementById('btnMovePage').addEventListener('click', openMoveModal);
    document.getElementById('btnRenamePage').addEventListener('click', renamePage);
    document.getElementById('btnDeletePage').addEventListener('click', deletePage);
    document.getElementById('btnAddSection').addEventListener('click', addSection);
    document.getElementById('btnPageFeedback').addEventListener('click', openFeedbackModalForPage);
    document.getElementById('btnPageJourney').addEventListener('click', openJourneyModal);
    document.getElementById('btnSetMe').addEventListener('click', openMeModal);
    document.getElementById('btnManageStaff').addEventListener('click', openStaffModal);
    document.getElementById('btnFullPreview').addEventListener('click', previewFullPage);

    // 전체 시안 모달
    document.getElementById('fpvClose').addEventListener('click', () => closeModal('fullPreviewModal'));
    document.getElementById('fpvOpenWindow').addEventListener('click', previewFullPageInWindow);
    document.getElementById('fpvCommentAdd').addEventListener('click', submitFpvComment);
    document.getElementById('fpvCommentInput').addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitFpvComment();
    });
    document.getElementById('btnCopyFullHtml').addEventListener('click', copyFullPageHtml);
    const btnFT = document.getElementById('btnFontTokens');
    if (btnFT) btnFT.addEventListener('click', openFontTokensModal);
    const ftClose = document.getElementById('ftClose');
    if (ftClose) ftClose.addEventListener('click', () => closeModal('fontTokensModal'));
    const ftCloseFoot = document.getElementById('ftCloseFoot');
    if (ftCloseFoot) ftCloseFoot.addEventListener('click', () => closeModal('fontTokensModal'));
    const ftAdd = document.getElementById('ftAdd');
    if (ftAdd) ftAdd.addEventListener('click', addFontToken);
    const ftReset = document.getElementById('ftReset');
    if (ftReset) ftReset.addEventListener('click', resetFontTokens);
    // 폰트 시스템 컨펌 워크플로우
    const ftStatusBtn = document.getElementById('ftStatusBtn');
    if (ftStatusBtn) ftStatusBtn.addEventListener('click', e => { e.stopPropagation(); toggleFontStatusMenu(); });
    const ftStatusMenu = document.getElementById('ftStatusMenu');
    if (ftStatusMenu) {
      ftStatusMenu.querySelectorAll('.ft-status-item').forEach(btn => {
        btn.addEventListener('click', () => setFontSystemStatus(btn.dataset.status || null));
      });
    }
    // 메뉴 바깥 클릭 시 닫기
    document.addEventListener('click', e => {
      const menu = document.getElementById('ftStatusMenu');
      if (!menu || !menu.classList.contains('open')) return;
      if (e.target.closest('#ftStatusMenu') || e.target.closest('#ftStatusBtn')) return;
      menu.classList.remove('open');
    });
    // 메모 자동 저장 (debounce)
    const ftMemo = document.getElementById('ftMemo');
    if (ftMemo) {
      let memoTimer = null;
      ftMemo.addEventListener('input', () => {
        if (memoTimer) clearTimeout(memoTimer);
        memoTimer = setTimeout(() => updateFontSystemNote(ftMemo.value), 400);
      });
      ftMemo.addEventListener('blur', () => {
        if (memoTimer) { clearTimeout(memoTimer); memoTimer = null; }
        updateFontSystemNote(ftMemo.value);
      });
    }
    // 이력 패널 토글
    const ftHistoryBtn = document.getElementById('ftHistoryBtn');
    if (ftHistoryBtn) {
      ftHistoryBtn.addEventListener('click', () => {
        const panel = document.getElementById('ftHistoryPanel');
        if (!panel) return;
        const open = panel.style.display !== 'none';
        panel.style.display = open ? 'none' : 'block';
        if (!open) renderFontHistory();
      });
    }
    var btnPL = document.getElementById('btnCopyPageLink');
    if (btnPL) btnPL.addEventListener('click', function(){ copyPageLink(getActivePage().id); });
    document.getElementById('btnExport').addEventListener('click', exportJson);
    const btnShare = document.getElementById('btnShare');
    if (btnShare) btnShare.addEventListener('click', shareJson);
    document.getElementById('btnReset').addEventListener('click', resetAll);
    document.getElementById('importFile').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (f) importJson(f);
      e.target.value = '';
    });

    document.getElementById('edSave').addEventListener('click', saveEditor);
    document.getElementById('edRefresh').addEventListener('click', refreshEditorPreview);
    document.getElementById('edClose').addEventListener('click', () => closeModal('editorModal'));
    document.getElementById('edCancel').addEventListener('click', () => closeModal('editorModal'));
    document.getElementById('hsClose').addEventListener('click', () => closeModal('historyModal'));
    const hsCloseFoot = document.getElementById('hsCloseFoot');
    if (hsCloseFoot) hsCloseFoot.addEventListener('click', () => closeModal('historyModal'));
    const rmCloseFoot = document.getElementById('rmCloseFoot');
    if (rmCloseFoot) rmCloseFoot.addEventListener('click', () => closeModal('retentionModal'));

    document.getElementById('rbOpen').addEventListener('click', openRetention);
    document.getElementById('rbHide').addEventListener('click', () => {
      sessionStorage.setItem('retentionDismissed', '1');
      document.getElementById('retentionBanner').style.display = 'none';
    });
    document.getElementById('rmClose').addEventListener('click', () => closeModal('retentionModal'));
    document.getElementById('rmDelete').addEventListener('click', deleteSelectedRetention);
    document.getElementById('rmSelectAll').addEventListener('change', e => {
      document.querySelectorAll('#rmList input[type=checkbox]').forEach(c => { c.checked = e.target.checked; });
    });

    // 담당자 관리 모달
    document.getElementById('stfClose').addEventListener('click', () => closeModal('staffModal'));
    document.getElementById('stfCloseFoot').addEventListener('click', () => closeModal('staffModal'));
    document.getElementById('stfAdd').addEventListener('click', () => {
      const ok = addStaff(document.getElementById('stfName').value, document.getElementById('stfRole').value);
      if (ok) {
        document.getElementById('stfName').value = '';
        document.getElementById('stfRole').value = '';
        document.getElementById('stfName').focus();
      }
    });
    ['stfName', 'stfRole'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('stfAdd').click();
      });
    });

    // 내 이름 설정 모달
    document.getElementById('meClose').addEventListener('click', () => closeModal('meModal'));
    document.getElementById('meCloseFoot').addEventListener('click', () => closeModal('meModal'));
    document.getElementById('meClearBtn').addEventListener('click', () => {
      setMeStaffId(null);
      toast('익명 작성으로 되돌림', 'info');
    });

    // 피드백 모달
    document.getElementById('fbClose').addEventListener('click', () => closeModal('feedbackModal'));
    document.getElementById('fbCloseFoot').addEventListener('click', () => closeModal('feedbackModal'));
    document.getElementById('fbAdd').addEventListener('click', submitFeedback);
    document.getElementById('fbInput').addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitFeedback();
    });

    // 작업여정 모달
    document.getElementById('jnClose').addEventListener('click', () => closeModal('journeyModal'));
    document.getElementById('jnCloseFoot').addEventListener('click', () => closeModal('journeyModal'));
    document.querySelectorAll('[data-jn-type]').forEach(c => c.addEventListener('change', renderJourney));

    // 이동 모달
    document.getElementById('mvClose').addEventListener('click', () => closeModal('moveModal'));
    document.getElementById('mvCancel').addEventListener('click', () => closeModal('moveModal'));
    document.getElementById('mvApply').addEventListener('click', applyMove);

    // 마누스 워커 설정 모달
    document.getElementById('btnManusConfig').addEventListener('click', openManusConfigModal);
    document.getElementById('mcClose').addEventListener('click', () => closeModal('manusConfigModal'));
    document.getElementById('mcCancel').addEventListener('click', () => closeModal('manusConfigModal'));
    document.getElementById('mcSave').addEventListener('click', saveManusConfigEditor);
    document.getElementById('mcTest').addEventListener('click', testManusConfig);

    // 마누스 일괄 생성 모달
    document.getElementById('btnBatchGen').addEventListener('click', openBatchGenModal);
    document.getElementById('bgClose').addEventListener('click', () => { if (cancelBatchGen()) closeModal('batchGenModal'); });
    document.getElementById('bgCancel').addEventListener('click', () => { if (cancelBatchGen()) closeModal('batchGenModal'); });
    document.getElementById('bgStart').addEventListener('click', startBatchGen);
    document.getElementById('bgSelectAll').addEventListener('click', () => selectAllBatch(true));
    document.getElementById('bgSelectNone').addEventListener('click', () => selectAllBatch(false));

    // 📦 제품 관리 (마스터) 모달
    document.getElementById('btnProducts').addEventListener('click', openProductsModal);
    document.getElementById('prClose').addEventListener('click', () => closeModal('productsModal'));
    document.getElementById('prCloseFoot').addEventListener('click', () => closeModal('productsModal'));
    document.getElementById('prNew').addEventListener('click', () => openProductEditor(null));
    wireProductEditor();

    // 🏷 상품(Listings) + 모드 토글 + 대시보드
    wireListingsAndDashboard();
    // 페이지 로드 시 마지막 모드 복원
    loadAppMode();

    // 상세페이지 인스턴스 모달
    document.getElementById('btnInstances').addEventListener('click', openInstancesModal);
    document.getElementById('insClose').addEventListener('click', () => closeModal('instancesModal'));
    document.getElementById('insCloseFoot').addEventListener('click', () => closeModal('instancesModal'));
    document.getElementById('insNew').addEventListener('click', () => openInstanceEditor(null));
    document.getElementById('ieClose').addEventListener('click', () => closeModal('instanceEditor'));
    document.getElementById('ieCancel').addEventListener('click', () => closeModal('instanceEditor'));
    document.getElementById('ieSave').addEventListener('click', saveInstanceEditor);
    document.getElementById('ieTemplate').addEventListener('change', onInstanceTemplateChange);
    document.getElementById('ieAutoFill').addEventListener('click', openAutoFillModal);

    // Claude 자동채우기 설정 모달
    document.getElementById('btnClaudeConfig').addEventListener('click', openClaudeConfigModal);
    document.getElementById('ccClose').addEventListener('click', () => closeModal('claudeConfigModal'));
    document.getElementById('ccCancel').addEventListener('click', () => closeModal('claudeConfigModal'));
    document.getElementById('ccSave').addEventListener('click', saveClaudeConfigEditor);
    document.getElementById('ccTest').addEventListener('click', testClaudeConfig);

    // 자료로 자동채우기 모달 (Step E)
    document.getElementById('afClose').addEventListener('click', () => closeModal('autoFillModal'));
    document.getElementById('afCancel').addEventListener('click', () => closeModal('autoFillModal'));
    document.getElementById('afRun').addEventListener('click', runAutoFill);
    document.getElementById('afApply').addEventListener('click', applyAutoFillSelected);
    document.getElementById('afBack').addEventListener('click', () => showAutoFillStage('input'));
    document.getElementById('afSelectAll').addEventListener('click', () => autoFillSelectAll('all'));
    document.getElementById('afSelectNone').addEventListener('click', () => autoFillSelectAll('none'));
    document.getElementById('afSelectFilled').addEventListener('click', () => autoFillSelectAll('filled'));
    wireAutoFillDrop('afOwnDrop', 'afOwnFile', 'afOwnPick', 'own');
    wireAutoFillDrop('afRefDrop', 'afRefFile', 'afRefPick', 'ref');

    // 자료로 일괄 생성 모달 (Step F)
    document.getElementById('btnBatchAutoFill').addEventListener('click', openBatchAutoFillModal);
    document.getElementById('bafClose').addEventListener('click', () => { if (cancelBatchAutoFill()) closeModal('batchAutoFillModal'); });
    document.getElementById('bafCancel').addEventListener('click', () => { if (cancelBatchAutoFill()) closeModal('batchAutoFillModal'); });
    document.getElementById('bafStart').addEventListener('click', startBatchAutoFill);
    wireBatchAutoFillDrop('bafOwnDrop', 'bafOwnFile', 'bafOwnPick', 'own');
    wireBatchAutoFillDrop('bafRefDrop', 'bafRefFile', 'bafRefPick', 'ref');

    // 상세페이지 템플릿 모달
    document.getElementById('btnTemplates').addEventListener('click', openTemplatesModal);
    document.getElementById('tplClose').addEventListener('click', () => closeModal('templatesModal'));
    document.getElementById('tplCloseFoot').addEventListener('click', () => closeModal('templatesModal'));
    document.getElementById('tplNew').addEventListener('click', () => openTemplateEditor(null));
    document.getElementById('tplLoadDefault').addEventListener('click', loadPourDefaultTemplate);
    document.getElementById('teClose').addEventListener('click', () => closeModal('templateEditor'));
    document.getElementById('teCancel').addEventListener('click', () => closeModal('templateEditor'));
    document.getElementById('teSave').addEventListener('click', saveTemplateEditor);
    document.getElementById('teRefresh').addEventListener('click', refreshSlotsAfterHtmlChange);
    document.getElementById('teHtml').addEventListener('blur', refreshSlotsAfterHtmlChange);

    // 휴지통 모달
    document.getElementById('btnTrash').addEventListener('click', openTrashModal);
    document.getElementById('trClose').addEventListener('click', () => closeModal('trashModal'));
    document.getElementById('trCloseFoot').addEventListener('click', () => closeModal('trashModal'));
    document.getElementById('trEmpty').addEventListener('click', emptyTrashNow);

    document.querySelectorAll('.modal-mask').forEach(mask => {
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-mask.open').forEach(m => m.classList.remove('open'));
        closeStatusMenus();
      }
    });
    document.addEventListener('click', () => closeStatusMenus());

    window.addEventListener('online', () => {
      setSync('syncing', '재연결 중...');
      pushToFirestore();
    });
    window.addEventListener('offline', () => setSync('offline', '오프라인 — 연결되면 자동 동기화'));

    // ─────────────────────────────────────────────
    // 어드민 staff 동기화 — admin.html이 iframe에 staff 마스터를 postMessage로 전달.
    // 받으면 state.staff를 어드민 마스터로 교체하고, 활동 담당자(activeStaffId)를 본인으로 자동 설정.
    // builder의 자체 등록·삭제 UI는 isInAdminFrame=true일 때 안내문으로 대체.
    // ─────────────────────────────────────────────
    const isInAdminFrame = (() => { try { return window.parent && window.parent !== window; } catch (_) { return false; } })();
    if (isInAdminFrame) {
      window.addEventListener('message', (e) => {
        const msg = e.data;
        if (!msg || msg.type !== 'admin-staff-sync') return;
        const incoming = (msg.payload && Array.isArray(msg.payload.staff)) ? msg.payload.staff : [];
        const activeStaffId = msg.payload?.activeStaffId || null;
        // state.staff 교체 (어드민 마스터를 단일 진실 소스로)
        state.staff = incoming.map(s => ({
          id: s.id,
          name: s.name || '',
          role: s.role || '',
          color: s.color || null,
          email: s.email || null,
          fromAdmin: true,  // 표시: 어드민이 관리하는 항목
        }));
        // 활동 담당자 자동 설정 (없으면 그대로 두되, 캐시된 me staffId가 새 목록에 없으면 정리)
        try {
          if (activeStaffId && state.staff.some(s => s.id === activeStaffId)) {
            if (typeof setMeStaffId === 'function') setMeStaffId(activeStaffId);
            else localStorage.setItem('pourstore-renewal-me-staff-id', activeStaffId);
          } else {
            const cachedId = localStorage.getItem('pourstore-renewal-me-staff-id');
            if (cachedId && !state.staff.some(s => s.id === cachedId)) {
              localStorage.removeItem('pourstore-renewal-me-staff-id');
            }
          }
        } catch (_) {}
        saveState();
        // 화면 갱신
        try { renderAll(); } catch (_) {}
        try { if (typeof renderMeCard === 'function') renderMeCard(); } catch (_) {}
        try { if (typeof renderStaffList === 'function') renderStaffList(); } catch (_) {}
        try { if (typeof renderMeStaffOptions === 'function') renderMeStaffOptions(); } catch (_) {}
        console.log(`[builder] admin staff sync — ${state.staff.length}명 / active=${activeStaffId || '-'}`);
      });
      // 자체 등록 UI 비활성 안내 (담당자 관리 모달 내부)
      const stfAddBlock = document.querySelector('.staff-add');
      if (stfAddBlock) {
        stfAddBlock.innerHTML = '<div style="padding:12px 14px;background:var(--or-pale,#FFF7ED);border:1px dashed var(--or-l,#FED7AA);border-radius:8px;font-size:12px;color:var(--or-d,#EA580C);font-weight:700;line-height:1.6">담당자 등록·수정은 어드민의 <b>디자인/개발 센터 → 담당자 관리</b>에서 진행됩니다.<br/>여기 목록은 어드민 마스터를 자동으로 보여줍니다.</div>';
      }

      // ── 사이드바 담당자 영역 전면 정리 ──
      // 어드민에서 활동 담당자가 자동 설정되므로 builder의 "담당자" 섹션·"내 이름 설정"·"담당자 관리" 버튼은 불필요.
      // 휴지통(btnTrash)은 별도 기능이므로 유지.
      const meCard = document.getElementById('meCard');
      if (meCard) {
        // h3 "담당자" 라벨 숨김 (meCard 직전 형제)
        const prev = meCard.previousElementSibling;
        if (prev && prev.tagName === 'H3') prev.style.display = 'none';
        // me-info(아바타·이름·역할) 숨김
        const meInfo = meCard.querySelector('.me-info');
        if (meInfo) meInfo.style.display = 'none';
        // "내 이름 설정" + "담당자 관리" 버튼 행 숨김 (btnSetMe·btnManageStaff 부모)
        const btnSetMe = document.getElementById('btnSetMe');
        if (btnSetMe && btnSetMe.parentElement) btnSetMe.parentElement.style.display = 'none';
        // me-card 자체는 휴지통 컨테이너 역할로 유지하되, 어드민 안내 1줄을 위에 삽입
        if (!meCard.querySelector('.admin-managed-hint')) {
          const hint = document.createElement('div');
          hint.className = 'admin-managed-hint';
          hint.style.cssText = 'padding:8px 10px;background:var(--or-pale,#FFF7ED);border:1px dashed var(--or-l,#FED7AA);border-radius:6px;font-size:11px;color:var(--or-d,#EA580C);font-weight:700;line-height:1.5;margin-bottom:8px';
          hint.innerHTML = '담당자는 <b>어드민에서 자동 동기화</b>됩니다 ↗';
          meCard.insertBefore(hint, meCard.firstChild);
        }
      }
      // 어드민 부모에 "준비 완료" 신호 (즉시 동기화 요청)
      try { window.parent.postMessage({ type: 'builder-ready' }, '*'); } catch (_) {}
    }

    renderAll();
    initFirebase();
  });
})();
