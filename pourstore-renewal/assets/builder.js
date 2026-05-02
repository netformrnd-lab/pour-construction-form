(function () {
  'use strict';

  const STORAGE_KEY = 'pourstore-renewal-builder-v2';
  const STORAGE_KEY_V1 = 'pourstore-renewal-builder-v1';
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCBGjGzaTTyIwBs_a8355KfFKaWabJT3ac',
    authDomain: 'pour-exhibition.firebaseapp.com',
    projectId: 'pour-exhibition',
    storageBucket: 'pour-exhibition.firebasestorage.app',
    messagingSenderId: '881527274265',
    appId: '1:881527274265:web:0caad9688e30beb1ea6388',
  };
  const FIRESTORE_COLLECTION = 'pourstore-renewal-builder';
  const FIRESTORE_DOC = 'state';
  const SAVE_DEBOUNCE_MS = 600;

  let db = null;
  let firebaseReady = false;
  let saveTimer = null;
  let initialSnapshotConsumed = false;

  const SEED_STATS_HTML =
    '<iframe src="./pour-store-cafe24.html"\n' +
    '        title="실적 + 시공 갤러리 + 협력사 (기존 시안)"\n' +
    '        loading="lazy"\n' +
    '        style="width:100%; height:100vh; border:0; display:block;"></iframe>';

  const SEED_AI_RECOMMEND_HTML = `
<style>
.par * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Noto Sans KR', sans-serif; }
.par { --po:#F97316; --po-d:#EA580C; --po-l:#FFEDD5; --po-glow:rgba(249,115,22,.35); --pn:#0F1F5C; --bg:#FFFBF5; --card:#FFFFFF; --txt:#1F2937; --txt-d:#6B7280; --bd:#E5E7EB; --bd-h:#FED7AA; }
.par { position:relative; background:linear-gradient(180deg,#FFFBF5 0%,#FFF7ED 50%,#FFFBF5 100%); color:var(--txt); padding:56px 18px 80px; overflow:hidden; }
.par::before { content:''; position:absolute; inset:0; background-image: radial-gradient(circle at 20% 10%,rgba(249,115,22,.06) 0%,transparent 40%),radial-gradient(circle at 80% 90%,rgba(15,31,92,.04) 0%,transparent 40%); pointer-events:none; }
.par-inner { max-width:1080px; margin:0 auto; position:relative; z-index:1; }
.par-hero { text-align:center; margin-bottom:24px; }
.par-core { width:84px; height:84px; margin:0 auto 14px; position:relative; display:grid; place-items:center; }
.par-core .ring { position:absolute; inset:0; border:2px solid var(--po); border-radius:50%; animation:par-spin 14s linear infinite; opacity:.4; }
.par-core .ring2 { position:absolute; inset:8px; border:1px dashed var(--po-d); border-radius:50%; animation:par-spin 9s linear infinite reverse; opacity:.5; }
.par-core .center { width:60px; height:60px; background:linear-gradient(135deg,var(--po),var(--po-d)); border-radius:50%; display:grid; place-items:center; font-size:32px; box-shadow:0 8px 22px var(--po-glow); position:relative; z-index:2; }
@keyframes par-spin { to { transform:rotate(360deg); } }
.par-kicker { display:inline-flex; align-items:center; gap:8px; padding:6px 16px; background:var(--po-l); border:1px solid var(--bd-h); border-radius:999px; font-size:11px; font-weight:800; color:var(--po-d); margin-bottom:14px; }
.par-kicker .ld { width:6px; height:6px; background:var(--po); border-radius:50%; box-shadow:0 0 6px var(--po); animation:par-blink 1.4s ease-in-out infinite; }
@keyframes par-blink { 50%{opacity:.3;} }
.par-hero h2 { font-size:26px; font-weight:900; margin:0 0 8px; letter-spacing:-.5px; color:var(--pn); line-height:1.35; }
.par-hero h2 .accent { color:var(--po); }
.par-hero p { font-size:13px; color:var(--txt-d); line-height:1.55; }
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
.par-final-cta { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px; }
.par-final-cta .big { padding:18px; background:linear-gradient(135deg,var(--po),var(--po-d)); border:0; border-radius:12px; color:#fff; font-size:14px; font-weight:800; text-align:center; box-shadow:0 6px 18px var(--po-glow); text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.par-final-cta .alt { padding:18px; background:#fff; border:2px solid var(--pn); border-radius:12px; color:var(--pn); font-size:14px; font-weight:800; text-align:center; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.par-final-cta .alt:hover { background:var(--pn); color:#fff; }
.par-storage-note { padding:12px 14px; background:var(--po-l); border-left:3px solid var(--po); border-radius:0 8px 8px 0; font-size:12px; color:var(--txt); margin-top:14px; line-height:1.6; }
.par-storage-note b { color:var(--po-d); }
@media (max-width:720px) { .par{padding:40px 12px 60px;} .par-hero h2{font-size:21px;} .par-stepper .stp{font-size:11px; padding:7px 10px;} .par-stepper .ar{display:none;} .par-entry{grid-template-columns:1fr;} .par-final-cta{grid-template-columns:1fr;} .par-products{grid-template-columns:repeat(2,1fr);} .par-method h3{font-size:19px;} }
</style>
<section class="par">
  <div class="par-inner">
    <div class="par-hero">
      <div class="par-core"><div class="ring"></div><div class="ring2"></div><div class="center">🧭</div></div>
      <span class="par-kicker"><span class="ld"></span>POUR 길잡이 · 건물 유지보수 안내</span>
      <h2>어디가 아프세요? <span class="accent">길잡이가 안내해드릴게요</span></h2>
      <p>260만 세대가 검증한 진단 — 사진 한 장이면 끝나요</p>
    </div>
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
        <a class="big" id="par-buy-package" href="#" target="_blank" rel="noopener">🛒 패키지 한 번에 구매하기</a>
        <a class="alt" id="par-consult" href="#" target="_blank" rel="noopener">💬 시공 의뢰·상담</a>
      </div>
      <div class="par-cta-row" style="margin-top:18px;">
        <button class="par-cta-ghost" id="par-restart">↻ 다른 고민 물어보기</button>
      </div>
    </div>
  </div>
</section>
<script>
(function(){
var BLDS=[{id:'apt',ic:'🏢',name:'아파트 (고층)',desc:'8층 이상 공동주택, 고층 빌라'},{id:'low',ic:'🏠',name:'단독·저층 주택',desc:'단독, 다가구, 저층 빌라'},{id:'comm',ic:'🏬',name:'상가·오피스텔',desc:'근린상가, 오피스, 학원'},{id:'fact',ic:'🏭',name:'공장·창고',desc:'공장 지붕, 창고, 물류센터'},{id:'gov',ic:'🏛',name:'관공서·학교',desc:'관공서, 학교, 공공시설'}];
var SURFS=[{id:'roof',ic:'🏠',name:'옥상·지붕',desc:'슬라브, 슁글, 기와, 칼라강판'},{id:'wall',ic:'🧱',name:'외벽',desc:'균열, 도장, 백화'},{id:'parking',ic:'🅿️',name:'지하 주차장',desc:'바닥, 벽체, 천장'},{id:'balcony',ic:'🏡',name:'발코니·베란다',desc:'바닥, 벽, 배수'},{id:'drain',ic:'💧',name:'배수구·배관',desc:'옥상 드레인, 빗물받이'},{id:'road',ic:'🛣️',name:'단지내 도로',desc:'주차장, 도로 균열·포트홀'},{id:'underg',ic:'🕳️',name:'지하실·수조',desc:'배면 누수, 곰팡이'},{id:'etc',ic:'📐',name:'기타',desc:'분류가 어려운 경우'}];
var SYMPS=['누수','균열','박리','부식','강풍 탈락','마모','미끄럼','곰팡이','백화','단차'];
var PROFILES=[
{keys:{surf:['drain']},qText:'배수구 쪽에서 물이 새서 누수가 생겼어요.',diagH:'배수구 부식 — <span class="accent">물이 자주 닿아서</span> 생긴 문제예요',diagPoints:['배수구는 비·눈·결로 등 <b>물이 가장 자주 닿는</b> 곳이에요.','오랫동안 물에 노출되면 콘크리트와 금속이 <b>녹슬고 약해집니다</b>.','배수가 막히면 고인 물이 <b>슬라브 균열을 더 빨리 만들어요</b>.','결국 배수구 → 슬라브 균열 → 천장 누수까지 진행돼요.'],sol:{code:'METHOD-149',name:'옥상배관방수트랩 공법',summary:'배수구를 일체화 방수트랩으로 바꿔서 부식과 누수를 한 번에 해결합니다.',principles:['배수구 주변 콘크리트와 트랩을 한 덩어리로 시공','특수 방수재로 이음부를 완전히 막음','배수 효율은 그대로, 부식만 차단','시공 후 정기 점검 가이드 함께 제공'],evidence:[{lbl:'시방서',val:'No.149',src:'POUR솔루션'},{lbl:'시공 사례',val:'700+',unit:'단지',src:'전국'}],products:[{role:'CORE',name:'POUR 방수트랩 일체형',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=DRAIN',url:'https://www.pourstore.net/product/drain-trap'},{role:'BOND',name:'POUR하이퍼티 (608% 신장)',price:'68,000',img:'https://placehold.co/300x300/F97316/fff?text=HYPER',url:'https://www.pourstore.net/product/hyper-t'},{role:'FINISH',name:'POUR코트재 마감',price:'95,000',img:'https://placehold.co/300x300/F97316/fff?text=COAT',url:'https://www.pourstore.net/product/coat'}],packageUrl:'https://www.pourstore.net/category/drain-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{bld:['apt'],surf:['roof'],symp:['강풍 탈락']},qText:'고층 아파트 지붕 슁글이 자꾸 떨어져요.',diagH:'슁글의 본래 용도 — <span class="accent">미국 저층 목조주택</span>용이었어요',diagPoints:['아스팔트 슁글은 원래 <b>미국 저층 목조주택의 미관용</b> 마감재예요.','국내 고층 아파트에 쓰면 <b>강풍에 쉽게 떨어져요</b>.','풍속 30m/s 이상이면 떨어지기 시작 → 추락·누수 위험이 같이 와요.','단순 재부착이 아니라 <b>건물과 한 덩어리로 만드는 방식</b>이 필요해요.'],sol:{code:'METHOD-128',name:'복합시트방수공법',summary:'시트와 도료로 슁글·슬라브를 완전히 일체화시켜 떨어지는 것을 막고 방수까지 같이 해결합니다.',principles:['슁글 위에 POUR슈퍼복합압축시트 부착','도료로 시트·슁글·슬라브를 한 덩어리로','POUR HOOKER 특허로 후레싱 단단히 고정','6단계 방수 공정'],evidence:[{lbl:'인장강도',val:'11.4',unit:'N/mm²',src:'KTR · 타사 10배'},{lbl:'시방서',val:'No.128',src:'POUR솔루션'}],products:[{role:'CORE',name:'POUR슈퍼복합압축시트',price:'450,000',img:'https://placehold.co/300x300/F97316/fff?text=SHEET',url:'https://www.pourstore.net/product/composite-sheet'},{role:'BOND',name:'POUR코트재',price:'280,000',img:'https://placehold.co/300x300/F97316/fff?text=COAT',url:'https://www.pourstore.net/product/coat'},{role:'FIX',name:'POUR HOOKER',price:'120,000',img:'https://placehold.co/300x300/F97316/fff?text=HOOKER',url:'https://www.pourstore.net/product/hooker'}],packageUrl:'https://www.pourstore.net/category/shingle-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['roof']},qText:'옥상 슬라브에서 물이 새고 콘크리트에 잔금이 많아요.',diagH:'슬라브 노후화 — <span class="accent">콘크리트가 늙어가는 중</span>이에요',diagPoints:['시간이 지나면 콘크리트가 <b>공기와 반응해 약해져요</b>.','안에 있는 철근이 녹슬며 <b>균열·박리</b>가 빨라집니다.','단순 도장만으로는 1~2년 안에 다시 똑같이 됩니다.','<b>바탕면 강화 + 듀얼 방수 + 환기 처리</b>가 함께 필요해요.'],sol:{code:'METHOD-132',name:'슬라브 듀얼강화방수공법',summary:'바탕면 강화부터 듀얼복합시트, 페이퍼팬벤트 환기, 코트재 마감까지 6가지를 한 번에 처리합니다.',principles:['POUR모체강화함침 — 늙은 콘크리트 강화','듀얼복합시트 + 슈퍼복합압축시트 이중 방수','POUR페이퍼팬벤트로 내부 습기 자연 배출','POUR코트재 마감 — 일사반사율 91.8%'],evidence:[{lbl:'인장강도',val:'5.8',unit:'N/mm²',src:'KTR · KS 4배'},{lbl:'중성화',val:'0.3',unit:'mm',src:'KTR'}],products:[{role:'BASE',name:'POUR모체강화함침',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=BASE',url:'https://www.pourstore.net/product/base'},{role:'CORE',name:'듀얼복합시트',price:'520,000',img:'https://placehold.co/300x300/F97316/fff?text=DUAL',url:'https://www.pourstore.net/product/dual-sheet'},{role:'VENT',name:'POUR페이퍼팬벤트',price:'95,000',img:'https://placehold.co/300x300/F97316/fff?text=VENT',url:'https://www.pourstore.net/product/vent'}],packageUrl:'https://www.pourstore.net/category/slab-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['wall']},qText:'외벽에 균열이 생겨 도색을 다시 해야 할 것 같아요.',diagH:'외벽 균열 — <span class="accent">단순 도색은 1~2년이면 또 갈라져요</span>',diagPoints:['온도 차이로 콘크리트가 <b>늘어났다 줄었다</b>를 반복하며 미세 균열이 생겨요.','미세 균열로 빗물이 들어가면 → 철근이 녹슬고 → 도장이 떨어집니다.','단순 재도색은 표면만 가리는 거라 곧 다시 갈라져요.','균열 보수 + 탄성 도료 + 차열 처리가 함께 필요해요.'],sol:{code:'METHOD-139',name:'바인더+플러스 (고급형) 재도장',summary:'POUR하이퍼티로 균열을 봉합한 후 플러스 코트로 탄성·차열을 강화합니다.',principles:['POUR하이퍼티 — 600% 늘어나는 퍼티','플러스 코트로 탄성·차열·중성화 방지','중성화 깊이 0.0mm','아파트·관공서 대형 현장 권장'],evidence:[{lbl:'신장률',val:'519',unit:'%',src:'KTR · 5배'},{lbl:'중성화',val:'0.0',unit:'mm',src:'KTR'}],products:[{role:'CORE',name:'POUR하이퍼티 (608%)',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=HYPER',url:'https://www.pourstore.net/product/hyper-t'},{role:'COAT',name:'POUR 플러스 코트',price:'320,000',img:'https://placehold.co/300x300/F97316/fff?text=PLUS',url:'https://www.pourstore.net/product/plus'},{role:'BIND',name:'POUR 바인더',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=BINDER',url:'https://www.pourstore.net/product/binder'}],packageUrl:'https://www.pourstore.net/category/wall-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{surf:['parking']},qText:'지하주차장 바닥이 갈라지고 페인트가 벗겨져요.',diagH:'에폭시 도장 노후 — <span class="accent">차량 하중과 결로</span>가 원인이에요',diagPoints:['차량이 반복해 다니며 도장면이 <b>마모돼요</b>.','결로·습기가 들어가면 바탕면이 <b>박리</b>됩니다.','소음·미세분진이 발생하고 미관도 나빠져요.','<b>마모에 강하고 미끄럽지 않은</b> 도장이 필요해요.'],sol:{code:'METHOD-125',name:'에폭시 + 엠보라이닝 도장',summary:'압축강도 85.9N/mm²의 고강도 에폭시 + 엠보라이닝.',principles:['바탕면 면처리 + 프라이머','에폭시 본도장 — 압축강도 85.9N/mm²','엠보라이닝 — 미끄럼 방지','내마모성 76mg'],evidence:[{lbl:'압축강도',val:'85.9',unit:'N/mm²',src:'KTR'},{lbl:'부착강도',val:'2.3',unit:'MPa',src:'KTR'},{lbl:'내마모',val:'76',unit:'mg',src:'KTR'}],products:[{role:'PRIME',name:'POUR 에폭시 프라이머',price:'140,000',img:'https://placehold.co/300x300/F97316/fff?text=PRIMER',url:'https://www.pourstore.net/product/epoxy-primer'},{role:'CORE',name:'POUR 에폭시 본도장',price:'380,000',img:'https://placehold.co/300x300/F97316/fff?text=EPOXY',url:'https://www.pourstore.net/product/epoxy'},{role:'TOP',name:'엠보라이닝 코트',price:'220,000',img:'https://placehold.co/300x300/F97316/fff?text=EMBO',url:'https://www.pourstore.net/product/embo'}],packageUrl:'https://www.pourstore.net/category/parking-package',consultUrl:'https://www.poursolution.net/168'}},
{keys:{surf:['underg']},qText:'지하실 벽에서 물이 스며 나오고 곰팡이가 생겨요.',diagH:'지하 배면 누수 — <span class="accent">표면 처리만으로는 못 막아요</span>',diagPoints:['지하는 흙과 지하수가 콘크리트 <b>뒷면에서 밀려옵니다</b>.','내부 표면 도장은 곧 부풀어 떨어집니다.','아크릴 방수재를 <b>초고압으로 주입</b>해 새 방수층을 만들어야 해요.','국토교통부 지정 건설신기술로 검증된 방법이에요.'],sol:{code:'METHOD-137',name:'아크릴배면차수공법',summary:'2액형 아크릴 방수재를 초고압으로 콘크리트 배면에 주입해 새 방수층을 만듭니다.',principles:['구조물 외부에서 직접 닿지 않아도 가능','초고압 주입으로 균열·공극까지 채움','국토교통부 건설신기술 1026호','지하주차장·수조·정수장 적용'],evidence:[{lbl:'건설신기술',val:'1026',unit:'호',src:'국토교통부'}],products:[{role:'CORE',name:'2액형 아크릴 방수재',price:'380,000',img:'https://placehold.co/300x300/F97316/fff?text=ACRYLIC',url:'https://www.pourstore.net/product/acrylic'},{role:'EQUIP',name:'초고압 주입 시공',price:'견적',img:'https://placehold.co/300x300/F97316/fff?text=PUMP',url:'https://www.poursolution.net/137'}],packageUrl:'https://www.pourstore.net/category/underground-package',consultUrl:'https://www.poursolution.net/168'}},
{keys:{surf:['road']},qText:'단지 내 도로 아스팔트가 갈라지고 구멍이 생겼어요.',diagH:'아스팔트 노후 — <span class="accent">층 사이가 분리</span>되었어요',diagPoints:['시간이 지나면 아스팔트는 <b>유연성을 잃고 갈라져요</b>.','균열로 빗물이 들어가면 <b>포트홀</b>로 발전합니다.','단순 메우기는 6개월 안에 똑같이 됩니다.','<b>POUR아스콘 + 균열보수</b> 통합 시공이 필요해요.'],sol:{code:'METHOD-167',name:'POUR아스콘 도로포장공법',summary:'아스팔트 균열 보수와 도로포장을 한 번에 처리합니다.',principles:['균열 부위 절단 후 청소','POUR 아스콘 채움재로 균열 봉합','신규 아스팔트 포장','단지내 도로·주차장 적용'],evidence:[{lbl:'시방서',val:'No.167',src:'POUR솔루션'}],products:[{role:'PATCH',name:'POUR 아스팔트균열보수재',price:'120,000',img:'https://placehold.co/300x300/F97316/fff?text=PATCH',url:'https://www.pourstore.net/product/asphalt-patch'},{role:'CORE',name:'POUR 아스콘',price:'견적',img:'https://placehold.co/300x300/F97316/fff?text=ASCON',url:'https://www.poursolution.net/167'}],packageUrl:'https://www.pourstore.net/category/road-package',consultUrl:'https://www.poursolution.net/163'}},
{keys:{},qText:'건물에 노후 문제가 있어요. 진단을 받아보고 싶어요.',diagH:'노후 콘크리트 — <span class="accent">중성화·균열</span>이 진행 중이에요',diagPoints:['대부분의 건물 노후 문제는 <b>콘크리트 중성화</b>에서 시작돼요.','중성화 → 미세 균열 → 빗물 침투 → 철근 부식.','표면 처리만으로는 근본 해결이 어려워요.','<b>모체 강화 + 균열 보수 + 마감 보호</b> 3단계가 필요해요.'],sol:{code:'POUR 종합진단',name:'맞춤 진단 + 패키지 추천',summary:'전문가가 직접 방문해서 분석하고 맞춤 패키지를 제안드려요.',principles:['현장 방문 진단 (무료)','시공 데이터 기반 맞춤 패키지','700+ 단지 시공 사례 참고','시공 후 사후 관리 가이드'],evidence:[{lbl:'누적 시공',val:'2.6M',unit:'세대',src:'전국'},{lbl:'특허·인증',val:'70+',unit:'건',src:'KTR/KCL'}],products:[{role:'CORE',name:'POUR하이퍼티',price:'180,000',img:'https://placehold.co/300x300/F97316/fff?text=HYPER',url:'https://www.pourstore.net/product/hyper-t'},{role:'COAT',name:'POUR코트재',price:'95,000',img:'https://placehold.co/300x300/F97316/fff?text=COAT',url:'https://www.pourstore.net/product/coat'}],packageUrl:'https://www.pourstore.net/category/general',consultUrl:'https://www.poursolution.net/163'}}
];
var state={screen:'entry',photos:[],detected:null,choice:{bld:null,surf:null,syms:[],memo:''}};
var root=document.querySelector('.par');
function show(name){state.screen=name;root.querySelectorAll('.par-screen').forEach(function(s){s.classList.toggle('active',s.dataset.screen===name);});var stepIdx=({entry:1,photo:2,analyzing:2,'photo-result':2,manual1:2,manual2:2,manual3:2,diagnosis:3,solution:4})[name]||1;root.querySelectorAll('.par-stepper .stp').forEach(function(el,i){el.classList.remove('active','done');if(i+1<stepIdx)el.classList.add('done');else if(i+1===stepIdx)el.classList.add('active');});try{window.scrollTo({top:root.offsetTop-20,behavior:'smooth'});}catch(e){}}
root.querySelectorAll('[data-go]').forEach(function(el){el.addEventListener('click',function(){show(el.dataset.go);});});
root.querySelectorAll('[data-back]').forEach(function(el){el.addEventListener('click',function(){show(el.dataset.back);});});
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
root.querySelector('#par-go-diag').addEventListener('click',function(){state.choice.memo=(root.querySelector('#par-free-memo').value||'').trim();runDiagnosis(matchProfile(state.choice));});
function matchProfile(c){for(var i=0;i<PROFILES.length;i++){var p=PROFILES[i];if(!p.keys||!p.keys.surf)continue;if(p.keys.surf.indexOf(c.surf)===-1)continue;if(p.keys.bld&&p.keys.bld.indexOf(c.bld)===-1)continue;if(p.keys.symp&&c.syms&&!p.keys.symp.some(function(k){return c.syms.indexOf(k)!==-1;}))continue;return p;}return PROFILES[PROFILES.length-1];}
function runDiagnosis(profile){state.profile=profile;root.querySelector('#par-diag-h').innerHTML=profile.diagH;var ol=root.querySelector('#par-diag-points');ol.innerHTML='';profile.diagPoints.forEach(function(pt){var li=document.createElement('li');li.innerHTML=pt;ol.appendChild(li);});show('diagnosis');}
root.querySelector('#par-go-sol').addEventListener('click',function(){var s=(state.profile||PROFILES[0]).sol;root.querySelector('#par-sol-code').textContent=s.code;root.querySelector('#par-sol-name').textContent=s.name;root.querySelector('#par-sol-summary').textContent=s.summary;var pr=root.querySelector('#par-sol-principles');pr.innerHTML='';s.principles.forEach(function(t){var d=document.createElement('div');d.className='pr';d.innerHTML='<span class="dot"></span><span>'+t+'</span>';pr.appendChild(d);});var ev=root.querySelector('#par-sol-evidence');ev.innerHTML='';s.evidence.forEach(function(e){var b=document.createElement('div');b.className='par-ev';b.innerHTML='<div class="lbl">'+e.lbl+'</div><div class="val">'+e.val+(e.unit?'<span class="unit">'+e.unit+'</span>':'')+'</div>'+(e.src?'<div class="src">— '+e.src+'</div>':'');ev.appendChild(b);});var pwrap=root.querySelector('#par-sol-products-wrap');pwrap.innerHTML='<div class="par-products-h">필요한 자재 ('+s.products.length+'종) — 카드 클릭하면 자사몰로 이동</div><div class="par-products" id="par-sol-products"></div>';var pgrid=pwrap.querySelector('#par-sol-products');s.products.forEach(function(pd){var a=document.createElement('a');a.className='par-pcard';a.href=pd.url;a.target='_blank';a.rel='noopener';a.innerHTML='<div class="img" style="background-image:url(\\''+pd.img+'\\')"><span class="role">'+pd.role+'</span><span class="ext">↗ STORE</span></div><div class="body"><div class="name">'+pd.name+'</div><div class="price">'+pd.price+'<span class="won">원</span></div></div>';pgrid.appendChild(a);});root.querySelector('#par-buy-package').setAttribute('href',s.packageUrl||'https://www.pourstore.net');root.querySelector('#par-consult').setAttribute('href',s.consultUrl||'https://www.poursolution.net/163');show('solution');});
root.querySelector('#par-back-diag').addEventListener('click',function(){show(state.photos.length?'photo-result':'manual3');});
root.querySelector('#par-restart').addEventListener('click',function(){state.photos.forEach(function(p){try{URL.revokeObjectURL(p.url);}catch(e){}});state={screen:'entry',photos:[],detected:null,choice:{bld:null,surf:null,syms:[],memo:''}};renderThumbs();root.querySelectorAll('.par-sym.on').forEach(function(b){b.classList.remove('on');});var memo=root.querySelector('#par-free-memo');if(memo)memo.value='';show('entry');});
show('entry');
})();
</script>
`;

  const DEFAULT_PAGES = () => ([
    { id: 'main', name: '메인 페이지', file: 'index.html', sections: [
      mkSec('메인 배너', '', '슬라이드 배너 — 균열·방수·코팅 자재 세트 등 메인 비주얼'),
      mkSec('카테고리 항목 버튼', '', '제품구매·패키지구매·시공상담·시공가이드·쇼룸·부자재·체험교육·파트너사·고객센터 (8~9개 아이콘)'),
      mkSec('AI 맞춤 자재추천', SEED_AI_RECOMMEND_HTML, 'POUR 길잡이 — 라이트 오렌지 톤, 사진 진단 + 5단계 흐름 + 카페24 연결 (v2)', 'wip'),
      mkSec('인기 추천 상품', '', '베스트셀러 5종 카드'),
      mkSec('신상품 (안전용품·부자재)', '', 'NEW ARRIVALS — 이달의 안전용품·부자재 등 서브 자재 전시'),
      mkSec('서브카테고리 상품', '', '제비스코 라인 + 인테리어 (DREAM COAT + GROHOME)'),
      mkSec('유튜브 숏츠 연결', '', '시공/제품 숏츠 5종'),
      mkSec('서비스 소개', '', '대리점·파트너사·전시장 안내 카드 3종'),
      mkSec('자사몰 내 포스팅', '', '시공방법·노하우·하자해결 콘텐츠 카드 그리드'),
      mkSec('동영상 가이드', '', '시공방법 영상 + POUR솔루션 영상 통합'),
      mkSec('POUR스토어 실적관', SEED_STATS_HTML, '실적 수치 + 시공 갤러리 + 협력사 (기존 cafe24 시안 임베드)', 'requested'),
    ]},
    { id: 'about', name: '브랜드스토리 소개', file: 'about.html', sections: [
      mkSec('히어로 비주얼', '', ''),
      mkSec('회사 소개', '', ''),
      mkSec('핵심 기술 / R&D', '', ''),
      mkSec('인증·특허', '', ''),
      mkSec('연혁', '', ''),
      mkSec('하단 CTA', '', ''),
    ]},
    { id: 'products', name: '제품 소개', file: 'products.html', sections: [
      mkSec('카테고리 네비', '', ''),
      mkSec('베스트 상품', '', ''),
      mkSec('신제품', '', ''),
      mkSec('카테고리별 제품 그리드', '', ''),
      mkSec('시공 가이드 영상', '', ''),
    ]},
    { id: 'construction', name: '시공 사례', file: 'construction.html', sections: [
      mkSec('사례 인트로', '', ''),
      mkSec('지역별 필터', '', ''),
      mkSec('사례 갤러리', '', ''),
      mkSec('공법별 사례', '', ''),
      mkSec('고객 후기', '', ''),
    ]},
    { id: 'contact', name: '문의', file: 'contact.html', sections: [
      mkSec('문의 폼', '', ''),
      mkSec('매장 정보', '', ''),
      mkSec('카카오톡 채널', '', ''),
      mkSec('FAQ', '', ''),
    ]},
    { id: 'partners', name: '파트너사 소개·신청', file: 'partners.html', sections: [
      mkSec('히어로 + 신청 CTA', '', ''),
      mkSec('파트너사 혜택', '', ''),
      mkSec('자격 요건', '', ''),
      mkSec('진행 절차', '', '신청 → 검토 → 승인 → 서류 → 계약'),
      mkSec('주요 파트너사 로고', '', ''),
      mkSec('파트너사 신청 폼', '', ''),
      mkSec('자주 묻는 질문', '', ''),
    ]},
    { id: 'dealers', name: '대리점·공급 문의', file: 'dealers.html', sections: [
      mkSec('히어로', '', ''),
      mkSec('대리점 혜택·마진 구조', '', ''),
      mkSec('자격 요건', '', ''),
      mkSec('공급 가능 카테고리', '', ''),
      mkSec('진행 절차', '', ''),
      mkSec('대리점 신청 폼', '', ''),
      mkSec('자주 묻는 질문', '', ''),
    ]},
    { id: 'matching', name: '시공 연결 신청', file: 'matching.html', sections: [
      mkSec('히어로 + 진행 단계 미리보기', '', ''),
      mkSec('시공 가능 공법', '', ''),
      mkSec('신청 폼 (지역·건물유형·문제·예산)', '', ''),
      mkSec('매칭 절차', '', '신청 → AI 매칭 → 추천 파트너 → 선택 → 시공'),
      mkSec('전국 시공 네트워크', '', ''),
      mkSec('최근 시공 사례', '', ''),
      mkSec('고객 후기', '', ''),
    ]},
    { id: 'showroom', name: '전시장·쇼룸', file: 'showroom.html', sections: [
      mkSec('히어로', '', ''),
      mkSec('쇼룸 위치·약도', '', ''),
      mkSec('운영 시간', '', ''),
      mkSec('쇼룸 둘러보기 (갤러리)', '', ''),
      mkSec('전시 제품', '', ''),
      mkSec('방문 예약 폼', '', ''),
      mkSec('찾아오시는 길', '', ''),
    ]},
    { id: 'magazine', name: '스토어 매거진', file: 'magazine.html', sections: [
      mkSec('히어로 + 검색', '', '시공설명서·영상·포스팅 통합 콘텐츠 허브'),
      mkSec('콘텐츠 카테고리 탭', '', '시공방법 / 케이스스터디 / 제품 가이드 / 트렌드'),
      mkSec('에디터 PICK', '', ''),
      mkSec('이번 주 인기 시공 영상', '', ''),
      mkSec('시공 설명서 모음', '', ''),
      mkSec('자사몰 포스팅 카드 그리드', '', '오늘의집 스타일 — 사진 + 텍스트 카드'),
      mkSec('관련 상품 추천 (콘텐츠 → 상품 연결)', '', ''),
      mkSec('카테고리별 더보기', '', ''),
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
      return freshState();
    } catch (e) {
      console.error('[builder] loadState 실패:', e);
      return freshState();
    }
  }
  function addMissingDefaultPages(s) {
    // 사용자가 명시적으로 삭제한 페이지는 다시 추가하지 않음 (deletedDefaults 추적)
    s.deletedDefaults = s.deletedDefaults || [];
    const defaults = DEFAULT_PAGES();
    defaults.forEach(dp => {
      const exists = s.pages.some(p => p.id === dp.id);
      const wasDeleted = s.deletedDefaults.indexOf(dp.id) !== -1;
      if (!exists && !wasDeleted) s.pages.push(dp);
    });
  }
  function freshState() {
    return { pages: DEFAULT_PAGES(), history: {}, activePageId: 'main' };
  }
  function migrate(s) {
    s.history = s.history || {};
    s.activePageId = s.activePageId || (s.pages[0] && s.pages[0].id);
    s.pages.forEach(p => {
      p.sections = p.sections || [];
      p.sections.forEach(sec => {
        if (typeof sec.confirmed !== 'boolean') sec.confirmed = false;
        if (sec.confirmedAt === undefined) sec.confirmedAt = null;
        if (sec.note === undefined) sec.note = '';
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
      pushToFirestore(true);
      return;
    }
    const data = snap.data() || {};
    if (!data.state) { initialSnapshotConsumed = true; pushToFirestore(true); return; }
    // 자기 자신이 쓴 echo는 무시
    if (data.lastWrite && data.lastWrite === state.lastWrite) {
      setSync('synced', '동기화됨 ' + fmtTime(new Date()));
      initialSnapshotConsumed = true;
      return;
    }
    try {
      const remote = JSON.parse(data.state);
      if (!remote || !Array.isArray(remote.pages)) throw new Error('형식 오류');
      const previousActive = state.activePageId;
      state = migrate(remote);
      if (previousActive && state.pages.some(p => p.id === previousActive)) {
        state.activePageId = previousActive;
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
      renderAll();
      setSync('synced', initialSnapshotConsumed ? ('실시간 반영 ' + fmtTime(new Date())) : ('서버에서 불러옴 ' + fmtTime(new Date())));
      initialSnapshotConsumed = true;
    } catch (e) {
      console.error('[firestore] 원격 상태 적용 실패:', e);
      setSync('error', '원격 데이터 형식 오류');
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
    const payload = {
      state: JSON.stringify(state),
      lastWrite: state.lastWrite,
      updatedAt: new Date().toISOString(),
    };
    db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC)
      .set(payload, { merge: false })
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
    Object.keys(byKey).forEach(k => {
      const idxs = byKey[k].sort((a, b) => b - a);
      const list = state.history[k];
      if (!list) return;
      idxs.forEach(i => { if (i > 0 && i < list.length) { list.splice(i, 1); removed++; } });
      if (list.length === 0) delete state.history[k];
    });
    saveState();
    closeModal('retentionModal');
    checkOldHistoryAndNotify();
    toast(`${removed}건 영구 삭제됨`, 'info');
  }

  function getActivePage() {
    return state.pages.find(p => p.id === state.activePageId) || state.pages[0];
  }
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
  }

  // -------- rendering --------
  function renderAll() {
    if (checkShareLinkMode()) return; // 공유 링크 모드면 빌더 UI 렌더 안함
    renderPages();
    renderSections();
    checkOldHistoryAndNotify();
  }

  function renderPages() {
    const list = document.getElementById('pageList');
    list.innerHTML = '';
    state.pages.forEach(p => {
      const item = document.createElement('div');
      item.className = 'page-item' + (p.id === state.activePageId ? ' active' : '');
      item.innerHTML = `
        <div class="name">
          <span>${escapeHtml(p.name)}</span>
        </div>
        <span class="count">${p.sections.length}</span>
      `;
      item.addEventListener('click', () => {
        state.activePageId = p.id;
        // 페이지 전환은 본인 브라우저에만 적용 — Firestore 동기화 대상 아님
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
        renderAll();
      });
      list.appendChild(item);
    });
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
      card.className = 'section-card status-' + cardStatus;
      card.draggable = true;
      card.dataset.sectionId = s.id;
      const hasHtml = s.html && s.html.trim().length > 0;
      const histLen = (state.history[histKey(page.id, s.id)] || []).length;
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
            <button class="sm-item sm-reset"    data-status=""          type="button"><span class="sm-icon">⊘</span> 초안으로 되돌리기</button>
          </div>
        </div>
        <div class="order">${idx + 1}</div>
        <div class="info">
          <div class="name">
            <span>${escapeHtml(s.name)}</span>
            <span class="badge ${hasHtml ? 'ready' : 'empty'}">${hasHtml ? 'READY' : 'EMPTY'}</span>
            ${histLen ? `<span class="badge">v${histLen}</span>` : ''}
          </div>
          <div class="meta">${escapeHtml(s.note || '메모 없음')}${s.statusAt ? ` · ${statusLabel(s.status)} ${fmtDate(s.statusAt)}` : ''}</div>
        </div>
        <div class="controls">
          ${hasHtml ? '<button class="btn btn-sm btn-outline" data-act="copy" title="HTML 코드 복사">HTML 복사</button>' : ''}
          ${hasHtml ? '<button class="btn btn-sm btn-outline" data-act="link" title="이 섹션만 보여주는 공유 링크 복사">🔗 링크</button>' : ''}
          <button class="btn btn-sm btn-ghost" data-act="preview">미리보기</button>
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
      const copyBtn = card.querySelector('[data-act=copy]');
      if (copyBtn) copyBtn.addEventListener('click', () => copyHtmlToClipboard(s.html));
      const linkBtn = card.querySelector('[data-act=link]');
      if (linkBtn) linkBtn.addEventListener('click', () => copySectionLink(page.id, s.id));
      card.querySelector('[data-act=preview]').addEventListener('click', () => previewSection(s.id));
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

  // -------- page CRUD --------
  function addPage() {
    const name = prompt('새 페이지 이름을 입력하세요. (예: 이벤트, FAQ 등)');
    if (!name || !name.trim()) return;
    const fileGuess = prompt('파일명을 입력하세요. (예: event.html)', slug(name) + '.html');
    if (!fileGuess) return;
    const id = 'p-' + Math.random().toString(36).slice(2, 8);
    state.pages.push({ id, name: name.trim(), file: fileGuess.trim(), sections: [] });
    state.activePageId = id;
    saveState();
    renderAll();
    toast('페이지 추가됨', 'success');
  }
  function renamePage() {
    const page = getActivePage();
    const name = prompt('페이지 이름', page.name);
    if (!name || !name.trim()) return;
    const file = prompt('파일명', page.file);
    if (!file || !file.trim()) return;
    page.name = name.trim();
    page.file = file.trim();
    saveState();
    renderAll();
  }
  function deletePage() {
    const page = getActivePage();
    if (state.pages.length <= 1) { toast('최소 1개 페이지는 유지해야 합니다.', 'error'); return; }
    if (!confirm(`'${page.name}' 페이지를 삭제할까요? 섹션과 이력이 모두 사라집니다.`)) return;
    page.sections.forEach(s => { delete state.history[histKey(page.id, s.id)]; });
    state.pages = state.pages.filter(p => p.id !== page.id);
    state.deletedDefaults = state.deletedDefaults || [];
    if (state.deletedDefaults.indexOf(page.id) === -1) state.deletedDefaults.push(page.id);
    state.activePageId = state.pages[0].id;
    saveState();
    renderAll();
    toast('페이지 삭제됨', 'info');
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
    delete state.history[histKey(page.id, secId)];
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
          </div>
        </div>
        <div class="reason-row">
          <span class="reason-label">변경 사유</span>
          <div class="reason-text ${v.reason ? '' : 'empty'}" data-act="edit-reason" title="클릭하여 수정">${v.reason ? escapeHtml(v.reason) : '(사유 없음 — 클릭하여 추가)'}</div>
        </div>
      `;
      row.querySelector('[data-act=copy]').addEventListener('click', () => copyHtmlToClipboard(v.html));
      row.querySelector('[data-act=view]').addEventListener('click', () => previewHtml(v.html, v.name));
      row.querySelector('[data-act=restore]').addEventListener('click', () => restoreVersion(idx));
      row.querySelector('[data-act=edit-reason]').addEventListener('click', () => startEditReason(row, idx));
      wrap.appendChild(row);
    });
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
  function wrapPreview(bodyHtml) {
    const baseHref = previewBaseHref();
    return [
      '<!doctype html><html lang="ko"><head><meta charset="UTF-8"/>',
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
      `<base href="${baseHref}"/>`,
      '<title>섹션 미리보기</title>',
      '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Bebas+Neue&display=swap" rel="stylesheet"/>',
      '<style>html,body{margin:0;font-family:\'Noto Sans KR\',sans-serif;background:#fff;color:#111827;}</style>',
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
      var body = page.sections.map(function(s, i){
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
    return page.sections.map((s, i) => {
      const html = (s.html || '').trim();
      if (!html) return `<!-- [${i+1}] ${s.name} (EMPTY) -->`;
      return `<!-- [${i+1}] ${s.name} -->\n<section data-section="${escapeHtml(s.name)}">\n${s.html}\n</section>`;
    }).join('\n\n');
  }

  function previewFullPage() {
    const page = getActivePage();
    const body = buildFullPageHtml(page);
    const w = window.open('', '_blank');
    if (!w) { toast('팝업이 차단되었습니다.', 'error'); return; }
    w.document.open();
    w.document.write(wrapPreview(body));
    w.document.close();
    try { w.document.title = `${page.name} 시안`; } catch (_) {}
  }

  function copyFullPageHtml() {
    const page = getActivePage();
    const filled = page.sections.filter(s => (s.html || '').trim());
    if (filled.length === 0) {
      toast('이 페이지에 입력된 섹션 HTML이 없습니다.', 'error');
      return;
    }
    const html = buildFullPageHtml(page);
    copyHtmlToClipboard(html);
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
    document.getElementById('btnRenamePage').addEventListener('click', renamePage);
    document.getElementById('btnDeletePage').addEventListener('click', deletePage);
    document.getElementById('btnAddSection').addEventListener('click', addSection);
    document.getElementById('btnFullPreview').addEventListener('click', previewFullPage);
    document.getElementById('btnCopyFullHtml').addEventListener('click', copyFullPageHtml);
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

    renderAll();
    initFirebase();
  });
})();
