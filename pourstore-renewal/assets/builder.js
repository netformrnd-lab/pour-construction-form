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
.par-final-cta { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px; }
.par-final-cta .big { padding:18px; background:linear-gradient(135deg,var(--po),var(--po-d)); border:0; border-radius:12px; color:#fff; font-size:14px; font-weight:800; text-align:center; box-shadow:0 6px 18px var(--po-glow); text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.par-final-cta .alt { padding:18px; background:#fff; border:2px solid var(--pn); border-radius:12px; color:var(--pn); font-size:14px; font-weight:800; text-align:center; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.par-final-cta .alt:hover { background:var(--pn); color:#fff; }
.par-storage-note { padding:12px 14px; background:var(--po-l); border-left:3px solid var(--po); border-radius:0 8px 8px 0; font-size:12px; color:var(--txt); margin-top:14px; line-height:1.6; }
.par-storage-note b { color:var(--po-d); }
@media (max-width:720px) { .par-stepper .stp{font-size:11px; padding:7px 10px;} .par-stepper .ar{display:none;} .par-entry{grid-template-columns:1fr;} .par-final-cta{grid-template-columns:1fr;} .par-products{grid-template-columns:repeat(2,1fr);} .par-method h3{font-size:19px;} .par-modal{max-height:96vh;} }
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
            <a class="big" id="par-buy-package" href="#" target="_blank" rel="noopener">🛒 패키지 한 번에 구매하기</a>
            <a class="alt" id="par-consult" href="#" target="_blank" rel="noopener">💬 시공 의뢰·상담</a>
          </div>
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
root.querySelector('#par-go-sol').addEventListener('click',function(){var s=(state.profile||PROFILES[0]).sol;root.querySelector('#par-sol-code').textContent=s.code;root.querySelector('#par-sol-name').textContent=s.name;root.querySelector('#par-sol-summary').textContent=s.summary;var pr=root.querySelector('#par-sol-principles');pr.innerHTML='';s.principles.forEach(function(t){var d=document.createElement('div');d.className='pr';d.innerHTML='<span class="dot"></span><span>'+t+'</span>';pr.appendChild(d);});var ev=root.querySelector('#par-sol-evidence');ev.innerHTML='';s.evidence.forEach(function(e){var b=document.createElement('div');b.className='par-ev';b.innerHTML='<div class="lbl">'+e.lbl+'</div><div class="val">'+e.val+(e.unit?'<span class="unit">'+e.unit+'</span>':'')+'</div>'+(e.src?'<div class="src">— '+e.src+'</div>':'');ev.appendChild(b);});var pwrap=root.querySelector('#par-sol-products-wrap');pwrap.innerHTML='<div class="par-products-h">필요한 자재 ('+s.products.length+'종) — 카드 클릭하면 자사몰로 이동</div><div class="par-products" id="par-sol-products"></div>';var pgrid=pwrap.querySelector('#par-sol-products');s.products.forEach(function(pd){var a=document.createElement('a');a.className='par-pcard';a.href=pd.url;a.target='_blank';a.rel='noopener';a.innerHTML='<div class="img" style="background-image:url(\\''+pd.img+'\\')"><span class="role">'+pd.role+'</span><span class="ext">↗ STORE</span></div><div class="body"><div class="name">'+pd.name+'</div><div class="price">'+pd.price+'<span class="won">원</span></div></div>';pgrid.appendChild(a);});root.querySelector('#par-buy-package').setAttribute('href',s.packageUrl||'https://www.pourstore.net');root.querySelector('#par-consult').setAttribute('href',s.consultUrl||'https://www.poursolution.net/163');show('solution');});
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
@media (max-width:520px) { .psc3-grid { grid-template-columns:repeat(4, 1fr); gap:6px; } .psc3-item { padding:14px 6px; } .psc3-item .icon { width:46px; height:46px; } .psc3-item .label { font-size:11.5px; } }
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
.psy3-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:14px; }
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
@media (max-width:520px) { .psy3-grid { grid-template-columns:repeat(2, 1fr); gap:10px; } .psy3-head h2 { font-size:24px; } }
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
    <div class="psy3-grid">
      <a class="psy3-card" href="https://www.pourstore.net/videos/short1"><div class="img" style="background-image:url('https://placehold.co/300x533/0F1F5C/F97316?text=DRAIN')"></div><span class="views">12K</span><span class="duration">0:48</span><div class="play"></div><div class="title">옥상 배수구 누수 1분 보수법</div></a>
      <a class="psy3-card" href="https://www.pourstore.net/videos/short2"><div class="img" style="background-image:url('https://placehold.co/300x533/EA580C/fff?text=ROOF')"></div><span class="views">8.5K</span><span class="duration">0:55</span><div class="play"></div><div class="title">방수보수 빌라·아파트 차이</div></a>
      <a class="psy3-card" href="https://www.pourstore.net/videos/short3"><div class="img" style="background-image:url('https://placehold.co/300x533/F97316/fff?text=SHINGLE')"></div><span class="views">15K</span><span class="duration">1:00</span><div class="play"></div><div class="title">슁글 지붕에 방수페인트 칠하면?</div></a>
      <a class="psy3-card" href="https://www.pourstore.net/videos/short4"><div class="img" style="background-image:url('https://placehold.co/300x533/059669/fff?text=CRACK')"></div><span class="views">6.2K</span><span class="duration">0:42</span><div class="play"></div><div class="title">콘크리트 균열 봉합 한 방에</div></a>
      <a class="psy3-card" href="https://www.pourstore.net/videos/short5"><div class="img" style="background-image:url('https://placehold.co/300x533/9333EA/fff?text=COAT')"></div><span class="views">9.8K</span><span class="duration">0:38</span><div class="play"></div><div class="title">옥상 방수는 코트재로 끝</div></a>
    </div>
  </div>
</section>`;

  const SEED_SERVICE_HTML = `<style>
.psv2 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.psv2 { background:#fff; padding:80px 18px; }
.psv2-inner { max-width:1200px; margin:0 auto; }
.psv2-head { text-align:center; margin-bottom:36px; }
.psv2-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:10px; }
.psv2-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:8px; }
.psv2-head p { font-size:14px; color:#6B7280; }
.psv2-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px; }
.psv2-card { padding:36px 30px; border-radius:24px; cursor:pointer; transition:all .3s; text-decoration:none; color:inherit; display:flex; flex-direction:column; gap:18px; position:relative; overflow:hidden; min-height:320px; background:#fff; border:1px solid #F3F4F6; }
.psv2-card::before { content:''; position:absolute; top:-30px; right:-30px; width:160px; height:160px; border-radius:50%; opacity:.12; transition:transform .35s; }
.psv2-card:hover { transform:translateY(-6px); box-shadow:0 24px 56px rgba(15,31,92,.14); border-color:transparent; }
.psv2-card:hover::before { transform:scale(1.4); }
.psv2-card .icon-wrap { width:64px; height:64px; border-radius:18px; display:grid; place-items:center; position:relative; z-index:1; }
.psv2-card .icon-wrap svg { width:30px; height:30px; fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
.psv2-card .label { display:inline-block; padding:5px 11px; border-radius:999px; font-size:10.5px; font-weight:800; letter-spacing:.5px; align-self:flex-start; position:relative; z-index:1; }
.psv2-card h3 { font-size:19px; font-weight:900; color:#0F1F5C; line-height:1.4; letter-spacing:-.4px; position:relative; z-index:1; }
.psv2-card p { font-size:13px; color:#6B7280; line-height:1.7; position:relative; z-index:1; flex:1; }
.psv2-card .arr { display:inline-flex; align-items:center; justify-content:space-between; padding:14px 18px; border-radius:14px; font-size:13px; font-weight:800; position:relative; z-index:1; transition:all .25s; }
.psv2-card.shop::before { background:#F97316; }
.psv2-card.shop .icon-wrap { background:linear-gradient(135deg,#FED7AA,#FB923C); }
.psv2-card.shop .icon-wrap svg { stroke:#7C2D12; }
.psv2-card.shop .label { background:#FFEDD5; color:#7C2D12; }
.psv2-card.shop .arr { background:#FFEDD5; color:#7C2D12; }
.psv2-card.shop:hover .arr { background:#F97316; color:#fff; }
.psv2-card.partner::before { background:#0F1F5C; }
.psv2-card.partner .icon-wrap { background:linear-gradient(135deg,#BFDBFE,#60A5FA); }
.psv2-card.partner .icon-wrap svg { stroke:#1E3A8A; }
.psv2-card.partner .label { background:#DBEAFE; color:#1E3A8A; }
.psv2-card.partner .arr { background:#DBEAFE; color:#1E3A8A; }
.psv2-card.partner:hover .arr { background:#0F1F5C; color:#fff; }
.psv2-card.show::before { background:#10B981; }
.psv2-card.show .icon-wrap { background:linear-gradient(135deg,#A7F3D0,#34D399); }
.psv2-card.show .icon-wrap svg { stroke:#064E3B; }
.psv2-card.show .label { background:#D1FAE5; color:#064E3B; }
.psv2-card.show .arr { background:#D1FAE5; color:#064E3B; }
.psv2-card.show:hover .arr { background:#10B981; color:#fff; }
.psv2-card .arr::after { content:'→'; transition:transform .25s; }
.psv2-card:hover .arr::after { transform:translateX(4px); }
@media (max-width:640px) { .psv2-card { padding:28px 24px; min-height:auto; } .psv2-head h2 { font-size:24px; } }
</style>
<section class="psv2">
  <div class="psv2-inner">
    <div class="psv2-head">
      <div class="kicker">SERVICE</div>
      <h2>POUR스토어 서비스 안내</h2>
      <p>대리점·파트너사·전시장 — 어떤 채널로 만나실래요?</p>
    </div>
    <div class="psv2-grid">
      <a class="psv2-card shop" href="https://www.pourstore.net/dealers">
        <div class="icon-wrap"><svg viewBox="0 0 24 24"><path d="M3 9V21h18V9"/><path d="M2 6h20l-2 3H4Z"/><path d="M16 14h-8"/></svg></div>
        <span class="label">대리점</span>
        <h3>건축물 유지보수, 직접 보고 만지고 채택해 선택하세요</h3>
        <p>잘못된 시공·불안한 자재 걱정 없이 — 가까운 대리점에서 실물 체험.</p>
        <span class="arr">대리점 신청 / 위치 보기</span>
      </a>
      <a class="psv2-card partner" href="https://www.pourstore.net/partners">
        <div class="icon-wrap"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <span class="label">파트너사</span>
        <h3>POUR스토어와 함께 유지보수 업계를 이끌 파트너 모집</h3>
        <p>전국 250+ 시공 파트너사와 함께 성장 — 안정적 발주 + 기술 교육 지원.</p>
        <span class="arr">파트너 신청</span>
      </a>
      <a class="psv2-card show" href="https://www.pourstore.net/showroom">
        <div class="icon-wrap"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></div>
        <span class="label">전시장 · 쇼룸</span>
        <h3>모든 자재를 직접 체험할 수 있는 전국 쇼룸</h3>
        <p>제품 실물·시공 결과물·교육 콘텐츠까지 한 공간에서.</p>
        <span class="arr">쇼룸 방문 예약</span>
      </a>
    </div>
  </div>
</section>`;

  const SEED_POSTING_HTML = `<style>
.psg3 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
.psg3 { background:#FFFBF5; padding:80px 18px; }
.psg3-inner { max-width:1200px; margin:0 auto; }
.psg3-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:32px; flex-wrap:wrap; gap:14px; }
.psg3-head .left { flex:1; min-width:240px; }
.psg3-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
.psg3-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
.psg3-head p { font-size:13.5px; color:#6B7280; margin-top:8px; }
.psg3-head .more { display:inline-flex; align-items:center; gap:6px; padding:11px 18px; background:#fff; border:1.5px solid #E5E7EB; border-radius:999px; color:#0F1F5C; font-size:13px; font-weight:800; text-decoration:none; transition:all .2s; }
.psg3-head .more:hover { border-color:#0F1F5C; background:#0F1F5C; color:#fff; }
.psg3-grid { display:grid; grid-template-columns:1.5fr 1fr 1fr; grid-template-rows:auto auto; gap:14px; }
.psg3-card { background:#fff; border-radius:20px; overflow:hidden; cursor:pointer; transition:all .3s; text-decoration:none; color:inherit; display:flex; flex-direction:column; border:1px solid #F3F4F6; }
.psg3-card:hover { transform:translateY(-4px); box-shadow:0 20px 44px rgba(15,31,92,.1); border-color:transparent; }
.psg3-card.feature { grid-row:span 2; }
.psg3-card .img { background:linear-gradient(135deg,#FED7AA,#FB923C) center/cover no-repeat; position:relative; flex-shrink:0; }
.psg3-card .img::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,transparent 50%, rgba(0,0,0,.05) 100%); }
.psg3-card.feature .img { aspect-ratio:1.4/1; }
.psg3-card:not(.feature) .img { aspect-ratio:16/10; }
.psg3-card .tag { position:absolute; top:14px; left:14px; padding:5px 11px; background:rgba(15,31,92,.95); color:#fff; font-size:10.5px; font-weight:800; border-radius:6px; backdrop-filter:blur(8px); letter-spacing:.5px; }
.psg3-card.feature .tag { background:#F97316; }
.psg3-card .meta-tl { position:absolute; bottom:14px; right:14px; display:flex; gap:6px; }
.psg3-card .meta-tl span { padding:4px 9px; background:rgba(0,0,0,.6); color:#fff; font-size:10.5px; font-weight:700; border-radius:5px; backdrop-filter:blur(4px); }
.psg3-card .body { padding:18px 20px 22px; flex:1; display:flex; flex-direction:column; }
.psg3-card.feature .body { padding:24px 26px 26px; }
.psg3-card .title { font-size:14.5px; font-weight:800; color:#0F1F5C; line-height:1.45; margin-bottom:8px; letter-spacing:-.3px; }
.psg3-card.feature .title { font-size:20px; line-height:1.3; }
.psg3-card .desc { font-size:12.5px; color:#6B7280; line-height:1.6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; flex:1; }
.psg3-card.feature .desc { font-size:14px; -webkit-line-clamp:3; }
.psg3-card .meta-bot { display:flex; gap:10px; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid #F3F4F6; font-size:11.5px; color:#9CA3AF; font-weight:600; }
.psg3-card .meta-bot .dot { width:3px; height:3px; background:#D1D5DB; border-radius:50%; }
@media (max-width:880px) { .psg3-grid { grid-template-columns:1fr 1fr; } .psg3-card.feature { grid-row:auto; grid-column:span 2; } }
@media (max-width:520px) { .psg3-grid { grid-template-columns:1fr; } .psg3-card.feature { grid-column:auto; } .psg3-head h2 { font-size:24px; } }
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
      <a class="psg3-card" href="https://www.pourstore.net/posts/silicone">
        <div class="img" style="background-image:url('https://placehold.co/600x375/D1D5DB/0F1F5C?text=SILICONE')"><span class="tag">노하우</span></div>
        <div class="body"><div class="title">실리콘이 답일까? 외벽 균열 보수의 진실</div><div class="desc">실리콘 보수의 한계와 600% 신축 하이퍼티가 답인 이유.</div><div class="meta-bot"><span>5일 전</span><span class="dot"></span><span>👁 2.1K</span></div></div>
      </a>
      <a class="psg3-card" href="https://www.pourstore.net/posts/leak-fix">
        <div class="img" style="background-image:url('https://placehold.co/600x375/059669/fff?text=DIY')"><span class="tag">셀프시공</span></div>
        <div class="body"><div class="title">크랙·누수 한 방에 — 빌라 옥상 셀프 방수 후기</div><div class="desc">평택 빌라 옥상 셀프 방수 사례, 비용·시간·결과 모두 공개.</div><div class="meta-bot"><span>1주 전</span><span class="dot"></span><span>👁 3.5K</span></div></div>
      </a>
      <a class="psg3-card" href="https://www.pourstore.net/posts/shingle-coat">
        <div class="img" style="background-image:url('https://placehold.co/600x375/B91C1C/fff?text=SHINGLE')"><span class="tag">슁글</span></div>
        <div class="body"><div class="title">아스팔트 슁글에 도막방수, 잘 버틸까?</div><div class="desc">경사형 지붕에 액체방수의 한계 — 시트+도료 일체화 방식이 답.</div><div class="meta-bot"><span>2주 전</span><span class="dot"></span><span>👁 1.8K</span></div></div>
      </a>
    </div>
  </div>
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
@media (max-width:880px) { .psg4-feature { grid-template-columns:1fr; } .psg4-side { flex-direction:row; overflow-x:auto; padding-bottom:8px; } .psg4-mini { min-width:280px; } .psg4-head h2 { font-size:24px; } }
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
        <p>POUR스토어는 R&D로 검증된 자재를 <b style="color:#0F1F5C">시너지 조합</b>으로 패키지화 — 어떤 부위든 한 번 구매로 완전 시공이 가능합니다</p>
      </div>
      <div class="ppr1-line">
        <button class="active">🏢 전체</button>
        <button>아파트 라인 (고층)</button>
        <button>일반 저층 (주택·상가)</button>
      </div>
      <div style="display:flex;justify-content:center;gap:14px;margin-bottom:18px;flex-wrap:wrap;font-size:11.5px;color:#6B7280;font-weight:700;">
        <span><span style="display:inline-block;width:10px;height:10px;background:#10B981;border-radius:50%;margin-right:5px;vertical-align:-1px;"></span>셀프 OK · 평지·난간 있음</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#F59E0B;border-radius:50%;margin-right:5px;vertical-align:-1px;"></span>저층만 셀프 가능</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#DC2626;border-radius:50%;margin-right:5px;vertical-align:-1px;"></span>시공연결 권장 · 경사 지붕·로프 작업</span>
      </div>
      <div class="ppr1-nav">
        <a class="ppr1-card" href="#area-slab"><div class="icon">🟦</div><div class="name">슬라브</div><div class="count">패키지 6종</div><span class="self ok">✅ 셀프 OK</span><span class="hot">HOT</span></a>
        <a class="ppr1-card" href="#area-shingle"><div class="icon">🏠</div><div class="name">아스팔트 슁글</div><div class="count">패키지 4종</div><span class="self pro">👷 시공연결</span></a>
        <a class="ppr1-card" href="#area-tile"><div class="icon">🧱</div><div class="name">금속 기와</div><div class="count">패키지 4종</div><span class="self pro">👷 시공연결</span></a>
        <a class="ppr1-card" href="#area-crack"><div class="icon">⚡</div><div class="name">균열 보수</div><div class="count">패키지 3종</div><span class="self warn">⚠️ 저층만 셀프</span></a>
        <a class="ppr1-card" href="#area-paint"><div class="icon">🎨</div><div class="name">재도장 (외벽)</div><div class="count">패키지 5종</div><span class="self pro">👷 시공연결</span><span class="hot">HOT</span></a>
        <a class="ppr1-card" href="#area-color"><div class="icon">🔩</div><div class="name">칼라강판·징크</div><div class="count">패키지 3종</div><span class="self pro">👷 시공연결</span></a>
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
              <div class="self-label">SELF GUIDE</div>
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
              <div class="self-label">SELF GUIDE · 풀세트</div>
              <div class="self-meta"><span>▶ 영상 5편</span><span>📄 시방서 PDF</span><span>📞 전화 코칭</span></div>
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
              <div class="self-label">SELF GUIDE</div>
              <div class="self-meta"><span>▶ 영상 3편</span><span>📄 설명서</span><span>✓ 셀프 가능</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="pprt-info">
        <div class="ico">📺</div>
        <div class="text">모든 패키지에는 <b>시공 영상·설명서·전화 코칭</b>이 함께 제공됩니다. R&D 시너지 조합 자재라 전문가 시공만큼의 결과를 만들 수 있어요. 직접 시공이 어려우시면 <b>시공 연결 신청</b>으로 가까운 파트너사를 매칭해 드립니다.</div>
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
            <div class="footer"><span class="self ok">✅ 셀프 OK</span><span class="media video">▶ 영상 5편</span><span class="media">📄 PDF</span></div>
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
            <div class="footer"><span class="self pro">👷 시공연결</span><span class="media video">▶ 영상 4편</span><span class="media">📄 PDF</span></div>
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
            <div class="footer"><span class="self ok">✅ 셀프 OK</span><span class="media video">▶ 영상 3편</span><span class="media">📄 PDF</span></div>
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
            <div class="footer"><span class="self ok">✅ 셀프 OK</span><span class="media video">▶ 영상 4편</span><span class="media">📄 PDF</span></div>
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
  .ppr3-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; }
  .ppr3-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; transition:all .25s; background:#fff; }
  .ppr3-head .more:hover { background:#FFF7ED; }
  .ppr3-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; }
  .ppr3-card { background:#fff; border:1px solid #F3F4F6; border-radius:16px; overflow:hidden; transition:all .3s; text-decoration:none; position:relative; }
  .ppr3-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(15,31,92,.08); border-color:#FED7AA; }
  .ppr3-thumb { aspect-ratio:5/4; background-size:cover; background-position:center; position:relative; }
  .ppr3-thumb .new { position:absolute; top:10px; left:10px; padding:4px 9px; background:#0F1F5C; color:#fff; font-size:10px; font-weight:900; border-radius:5px; letter-spacing:.5px; }
  .ppr3-info { padding:14px; }
  .ppr3-info .date { font-size:10.5px; font-weight:800; color:#EA580C; letter-spacing:.3px; margin-bottom:6px; }
  .ppr3-info .name { font-size:13.5px; font-weight:800; color:#0F1F5C; margin-bottom:8px; line-height:1.4; letter-spacing:-.3px; }
  .ppr3-info .price { display:flex; align-items:center; gap:6px; }
  .ppr3-info .now { font-size:15px; font-weight:900; color:#0F1F5C; }
  .ppr3-info .original { font-size:11px; color:#9CA3AF; text-decoration:line-through; font-weight:600; }
  @media (max-width:640px) { .ppr3-head h2 { font-size:22px; } }
  </style>
  <section class="ppr3">
    <div class="ppr3-inner">
      <div class="ppr3-head">
        <div>
          <div class="kicker">🆕 NEW ARRIVAL</div>
          <h2>이번 주 신상품</h2>
        </div>
        <a class="more" href="https://www.pourstore.net/new">전체 보기 →</a>
      </div>
      <div class="ppr3-grid">
        <a class="ppr3-card" href="#"><div class="ppr3-thumb" style="background-image:url('https://placehold.co/400x320/F97316/fff?text=NEW+VENT')"><div class="new">NEW</div></div><div class="ppr3-info"><div class="date">2026.04.30 입고</div><div class="name">페이퍼팬벤트 무동력 환기구</div><div class="price"><span class="now">38,000원</span><span class="original">42,000원</span></div></div></a>
        <a class="ppr3-card" href="#"><div class="ppr3-thumb" style="background-image:url('https://placehold.co/400x320/EA580C/fff?text=NEW+SAFE')"><div class="new">NEW</div></div><div class="ppr3-info"><div class="date">2026.04.28 입고</div><div class="name">고소작업 안전벨트 풀세트</div><div class="price"><span class="now">89,000원</span><span class="original">110,000원</span></div></div></a>
        <a class="ppr3-card" href="#"><div class="ppr3-thumb" style="background-image:url('https://placehold.co/400x320/0F1F5C/fff?text=NEW+ROLLER')"><div class="new">NEW</div></div><div class="ppr3-info"><div class="date">2026.04.25 입고</div><div class="name">코트재 전용 롤러 (12인치)</div><div class="price"><span class="now">12,000원</span><span class="original">15,000원</span></div></div></a>
        <a class="ppr3-card" href="#"><div class="ppr3-thumb" style="background-image:url('https://placehold.co/400x320/059669/fff?text=NEW+TRAP')"><div class="new">NEW</div></div><div class="ppr3-info"><div class="date">2026.04.22 입고</div><div class="name">옥상배관 방수트랩 키트</div><div class="price"><span class="now">56,000원</span><span class="original">65,000원</span></div></div></a>
      </div>
    </div>
  </section>`;

  const SEED_PR_GRID_HTML = `<style>
  .ppr4 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppr4 { background:#fff; padding:72px 18px; }
  .ppr4-inner { max-width:1200px; margin:0 auto; }
  .ppr4-head { text-align:center; margin-bottom:32px; }
  .ppr4-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppr4-head h2 { font-size:32px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:10px; }
  .ppr4-head p { font-size:14px; color:#6B7280; }
  .ppr4-tabs { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:28px; }
  .ppr4-tab { padding:9px 18px; background:#fff; border:1px solid #F3F4F6; border-radius:999px; font-size:13px; font-weight:700; color:#6B7280; cursor:pointer; transition:all .2s; }
  .ppr4-tab:hover { border-color:#FED7AA; color:#EA580C; }
  .ppr4-tab.active { background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border-color:transparent; box-shadow:0 6px 16px rgba(249,115,22,.3); }
  .ppr4-section { margin-bottom:48px; }
  .ppr4-section:last-child { margin-bottom:0; }
  .ppr4-section .group-head { display:flex; align-items:center; gap:10px; margin-bottom:18px; padding-bottom:14px; border-bottom:2px solid #FFEDD5; }
  .ppr4-section .group-head .badge { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#FFEDD5,#FED7AA); display:grid; place-items:center; font-size:16px; }
  .ppr4-section .group-head h3 { font-size:18px; font-weight:900; color:#0F1F5C; letter-spacing:-.3px; }
  .ppr4-section .group-head .cnt { font-size:11.5px; font-weight:800; color:#EA580C; padding:3px 8px; background:#FFF7ED; border-radius:6px; }
  .ppr4-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; }
  .ppr4-item { background:#fff; border:1px solid #F3F4F6; border-radius:14px; overflow:hidden; transition:all .25s; text-decoration:none; }
  .ppr4-item:hover { transform:translateY(-3px); box-shadow:0 14px 32px rgba(15,31,92,.08); border-color:#FED7AA; }
  .ppr4-item .thumb { aspect-ratio:1/1; background-size:cover; background-position:center; }
  .ppr4-item .info { padding:12px; }
  .ppr4-item .name { font-size:13px; font-weight:800; color:#0F1F5C; margin-bottom:6px; line-height:1.4; letter-spacing:-.3px; }
  .ppr4-item .price { font-size:14px; font-weight:900; color:#0F1F5C; }
  @media (max-width:640px) { .ppr4-head h2 { font-size:24px; } }
  </style>
  <section class="ppr4">
    <div class="ppr4-inner">
      <div class="ppr4-head">
        <div class="kicker">FULL CATALOG</div>
        <h2>카테고리별 제품 둘러보기</h2>
        <p>R&D 검증 자재만 — 카테고리별로 정리된 110+ 라인업</p>
      </div>
      <div class="ppr4-tabs">
        <button class="ppr4-tab active">전체</button>
        <button class="ppr4-tab">방수재</button>
        <button class="ppr4-tab">도장재</button>
        <button class="ppr4-tab">균열보수</button>
        <button class="ppr4-tab">코팅·단열</button>
        <button class="ppr4-tab">시공도구</button>
      </div>
      <div class="ppr4-section">
        <div class="group-head"><div class="badge">💧</div><h3>방수재</h3><span class="cnt">28종</span></div>
        <div class="ppr4-grid">
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/F97316/fff?text=COAT+5KG')"></div><div class="info"><div class="name">POUR 코트재 5kg</div><div class="price">68,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/EA580C/fff?text=COAT+20KG')"></div><div class="info"><div class="name">POUR 코트재 20kg</div><div class="price">240,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/0F1F5C/fff?text=SHEET')"></div><div class="info"><div class="name">슈퍼복합압축시트</div><div class="price">128,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/059669/fff?text=PVC')"></div><div class="info"><div class="name">PVC 방수재 (4L)</div><div class="price">52,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/FB923C/fff?text=URETHANE')"></div><div class="info"><div class="name">우레탄 방수재 (10kg)</div><div class="price">98,000원</div></div></a>
        </div>
      </div>
      <div class="ppr4-section">
        <div class="group-head"><div class="badge">🎨</div><h3>도장재</h3><span class="cnt">22종</span></div>
        <div class="ppr4-grid">
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/EA580C/fff?text=BINDER')"></div><div class="info"><div class="name">POUR 바인더 (15L)</div><div class="price">85,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/F97316/fff?text=PLUS')"></div><div class="info"><div class="name">POUR 플러스 외부용</div><div class="price">112,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/0F1F5C/fff?text=EPOXY')"></div><div class="info"><div class="name">에폭시 도료 (5kg)</div><div class="price">76,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/059669/fff?text=EMBO')"></div><div class="info"><div class="name">엠보라이닝 도료</div><div class="price">94,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/FB923C/fff?text=METAL')"></div><div class="info"><div class="name">금속기와 코팅재</div><div class="price">68,000원</div></div></a>
        </div>
      </div>
      <div class="ppr4-section">
        <div class="group-head"><div class="badge">🔧</div><h3>균열 보수</h3><span class="cnt">18종</span></div>
        <div class="ppr4-grid">
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/F97316/fff?text=HYPER+T')"></div><div class="info"><div class="name">POUR 하이퍼티 (4kg)</div><div class="price">42,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/EA580C/fff?text=POWDER')"></div><div class="info"><div class="name">탄성강화 파우더 (20kg)</div><div class="price">52,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/0F1F5C/fff?text=HOOKER')"></div><div class="info"><div class="name">POUR HOOKER (50개)</div><div class="price">88,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/059669/fff?text=ACRYLIC')"></div><div class="info"><div class="name">아크릴배면차수재</div><div class="price">128,000원</div></div></a>
          <a class="ppr4-item" href="#"><div class="thumb" style="background-image:url('https://placehold.co/300x300/FB923C/fff?text=CRACK+GEL')"></div><div class="info"><div class="name">균열 보수 젤 (1kg)</div><div class="price">28,000원</div></div></a>
        </div>
      </div>
    </div>
  </section>`;

  const SEED_PR_GUIDE_HTML = `<style>
  .ppr5 * { box-sizing:border-box; margin:0; padding:0; font-family:'Noto Sans KR',sans-serif; }
  .ppr5 { background:#FFFBF5; padding:72px 18px; }
  .ppr5-inner { max-width:1200px; margin:0 auto; }
  .ppr5-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:14px; }
  .ppr5-head .kicker { font-size:11.5px; font-weight:800; color:#EA580C; letter-spacing:1.5px; margin-bottom:8px; }
  .ppr5-head h2 { font-size:30px; font-weight:900; color:#0F1F5C; letter-spacing:-1px; line-height:1.2; margin-bottom:6px; }
  .ppr5-head p { font-size:13.5px; color:#6B7280; }
  .ppr5-head .more { font-size:13px; font-weight:700; color:#EA580C; text-decoration:none; padding:8px 14px; border:1px solid #FED7AA; border-radius:999px; background:#fff; transition:all .25s; }
  .ppr5-head .more:hover { background:#FFF7ED; }
  .ppr5-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:18px; }
  .ppr5-feature { position:relative; aspect-ratio:16/10; border-radius:18px; overflow:hidden; background-size:cover; background-position:center; text-decoration:none; transition:transform .3s; }
  .ppr5-feature:hover { transform:translateY(-3px); }
  .ppr5-feature::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg, rgba(15,31,92,.85) 0%, rgba(15,31,92,.2) 50%, transparent 100%); }
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
  @media (max-width:880px) { .ppr5-grid { grid-template-columns:1fr; } .ppr5-head h2 { font-size:22px; } }
  </style>
  <section class="ppr5">
    <div class="ppr5-inner">
      <div class="ppr5-head">
        <div>
          <div class="kicker">▶ HOW TO USE</div>
          <h2>제품별 시공 가이드 영상</h2>
          <p>구매 전·후 — 영상으로 미리 보고 안심하고 시공하세요</p>
        </div>
        <a class="more" href="https://www.pourstore.net/guide">전체 영상 →</a>
      </div>
      <div class="ppr5-grid">
        <a class="ppr5-feature" href="#" style="background-image:url('https://placehold.co/800x500/0F1F5C/fff?text=POUR+COAT+GUIDE')">
          <div class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
          <div class="info">
            <span class="badge">⭐ FEATURED</span>
            <div class="title">POUR 코트재 — 옥상 슬라브 시공 풀가이드</div>
            <div class="meta">14:28 · 조회 28K · 가이드 PICK</div>
          </div>
        </a>
        <div class="ppr5-list">
          <a class="ppr5-mini" href="#"><div class="thumb" style="background-image:url('https://placehold.co/200x125/F97316/fff?text=HYPER+T')"><div class="dur">8:42</div></div><div class="text"><div class="sub">균열 보수</div><div class="title">하이퍼티로 외벽 균열 보수 — 5분 정리</div><div class="meta">조회 12K</div></div></a>
          <a class="ppr5-mini" href="#"><div class="thumb" style="background-image:url('https://placehold.co/200x125/EA580C/fff?text=POWDER')"><div class="dur">11:15</div></div><div class="text"><div class="sub">단면 복구</div><div class="title">탄성강화 파우더 — 박락 단면 복구 시공법</div><div class="meta">조회 9.2K</div></div></a>
          <a class="ppr5-mini" href="#"><div class="thumb" style="background-image:url('https://placehold.co/200x125/059669/fff?text=HOOKER')"><div class="dur">6:08</div></div><div class="text"><div class="sub">후레싱 보강</div><div class="title">POUR HOOKER 시공 — 손상 마감면 대응</div><div class="meta">조회 7.8K</div></div></a>
          <a class="ppr5-mini" href="#"><div class="thumb" style="background-image:url('https://placehold.co/200x125/FB923C/fff?text=VENT')"><div class="dur">5:30</div></div><div class="text"><div class="sub">결로 방지</div><div class="title">페이퍼팬벤트 설치 — 무동력 환기로 들뜸 예방</div><div class="meta">조회 6.4K</div></div></a>
        </div>
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
      <form class="pct1-card">
        <div class="pct1-types">
          <div class="pct1-type active"><div class="icon">📦</div><div class="label">제품 문의</div></div>
          <div class="pct1-type"><div class="icon">🔧</div><div class="label">시공 문의</div></div>
          <div class="pct1-type"><div class="icon">🛠️</div><div class="label">셀프시공</div></div>
          <div class="pct1-type"><div class="icon">💬</div><div class="label">기타</div></div>
        </div>
        <div class="pct1-row split">
          <div><label>성함</label><input type="text" placeholder="홍길동"/></div>
          <div><label>연락처</label><input type="text" placeholder="010-0000-0000"/></div>
        </div>
        <div class="pct1-row"><label>이메일</label><input type="email" placeholder="example@email.com"/></div>
        <div class="pct1-row split">
          <div><label>건물 유형</label><select><option>선택해 주세요</option><option>아파트</option><option>관공서</option><option>일반건물</option><option>주택</option><option>기타</option></select></div>
          <div><label>지역</label><select><option>선택해 주세요</option><option>서울</option><option>경기</option><option>인천</option><option>부산</option><option>기타</option></select></div>
        </div>
        <div class="pct1-row"><label>문의 내용</label><textarea placeholder="문제 부위·증상·시급도 등을 자유롭게 적어주세요"></textarea></div>
        <div class="pct1-agree"><input type="checkbox" id="ag"/><label for="ag">개인정보 수집·이용에 동의합니다 <a href="#">(자세히)</a></label></div>
        <button type="submit" class="pct1-submit">문의 보내기</button>
      </form>
    </div>
  </section>`;

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
      <form class="ppt6-card">
        <div class="ppt6-section">
          <div class="stitle">📋 회사 정보</div>
          <div class="ppt6-row split">
            <div><label>회사명</label><input type="text" placeholder="㈜한울방수"/></div>
            <div><label>사업자등록번호</label><input type="text" placeholder="000-00-00000"/></div>
          </div>
          <div class="ppt6-row split">
            <div><label>대표자명</label><input type="text" placeholder="홍길동"/></div>
            <div><label>설립연도</label><input type="text" placeholder="2015"/></div>
          </div>
          <div class="ppt6-row"><label>사업장 주소</label><input type="text" placeholder="경기도 ○○시 ○○로 ○○"/></div>
        </div>
        <div class="ppt6-section">
          <div class="stitle">👤 담당자 정보</div>
          <div class="ppt6-row split">
            <div><label>담당자명</label><input type="text" placeholder="홍길동"/></div>
            <div><label>연락처</label><input type="text" placeholder="010-0000-0000"/></div>
          </div>
          <div class="ppt6-row"><label>이메일</label><input type="email" placeholder="example@email.com"/></div>
        </div>
        <div class="ppt6-section">
          <div class="stitle">🔧 시공 가능 분야 (복수 선택)</div>
          <div class="ppt6-checks">
            <div class="ppt6-check active">방수</div>
            <div class="ppt6-check active">도장</div>
            <div class="ppt6-check">균열 보수</div>
            <div class="ppt6-check">코팅·단열</div>
            <div class="ppt6-check">에폭시·바닥</div>
            <div class="ppt6-check">아스콘·토목</div>
            <div class="ppt6-check">기타</div>
          </div>
        </div>
        <div class="ppt6-section">
          <div class="stitle">📊 시공 실적</div>
          <div class="ppt6-row split">
            <div><label>시공 경력</label><select><option>3년 미만</option><option>3-5년</option><option>5-10년</option><option>10년 이상</option></select></div>
            <div><label>연 시공 건수</label><select><option>10건 미만</option><option>10-30건</option><option>30-100건</option><option>100건 이상</option></select></div>
          </div>
          <div class="ppt6-row"><label>주요 실적 (간단 기재)</label><textarea placeholder="최근 3년 주요 시공 단지·관공서·발주처 등"></textarea></div>
        </div>
        <div class="ppt6-section">
          <div class="stitle">📎 첨부 서류</div>
          <div class="ppt6-upload"><div class="icon">📎</div><div class="text">사업자등록증 · 시공 실적표 · 면허증 등</div><div class="hint">PDF, JPG, PNG (최대 20MB)</div></div>
        </div>
        <div class="ppt6-agree"><input type="checkbox" id="ag2"/><label for="ag2">개인정보·기업정보 수집·이용에 동의합니다</label></div>
        <button type="submit" class="ppt6-submit">파트너 신청하기</button>
      </form>
    </div>
  </section>`;

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
      <form class="pdl6-card">
        <div class="pdl6-section">
          <div class="stitle">📋 신청자 정보</div>
          <div class="pdl6-row split">
            <div><label>회사/상호명</label><input type="text" placeholder="○○건축자재"/></div>
            <div><label>사업자등록번호</label><input type="text" placeholder="000-00-00000"/></div>
          </div>
          <div class="pdl6-row split">
            <div><label>대표자명</label><input type="text" placeholder="홍길동"/></div>
            <div><label>연락처</label><input type="text" placeholder="010-0000-0000"/></div>
          </div>
          <div class="pdl6-row"><label>이메일</label><input type="email" placeholder="example@email.com"/></div>
        </div>
        <div class="pdl6-section">
          <div class="stitle">🏪 매장·재고 정보</div>
          <div class="pdl6-row"><label>매장 주소</label><input type="text" placeholder="○○도 ○○시 ○○로"/></div>
          <div class="pdl6-row split">
            <div><label>매장 규모</label><select><option>33-66㎡</option><option>66-99㎡</option><option>99-165㎡</option><option>165㎡ 이상</option></select></div>
            <div><label>창고 규모</label><select><option>창고 없음</option><option>33㎡ 미만</option><option>33-66㎡</option><option>66㎡ 이상</option></select></div>
          </div>
          <div class="pdl6-row"><label>희망 권역</label><input type="text" placeholder="예: 경기 남부 / 부산 해운대 일대"/></div>
        </div>
        <div class="pdl6-section">
          <div class="stitle">📊 사업 정보</div>
          <div class="pdl6-row split">
            <div><label>건설자재 유통 경력</label><select><option>없음</option><option>3년 미만</option><option>3-5년</option><option>5-10년</option><option>10년 이상</option></select></div>
            <div><label>예상 월 매출 목표</label><select><option>1천만원 미만</option><option>1천-3천만원</option><option>3천-5천만원</option><option>5천만원 이상</option></select></div>
          </div>
          <div class="pdl6-row"><label>주요 거래처·실적 (간단 기재)</label><textarea placeholder="기존 거래처·취급 자재·시공사 네트워크 등"></textarea></div>
        </div>
        <div class="pdl6-agree"><input type="checkbox" id="ag3"/><label for="ag3">개인정보·기업정보 수집·이용에 동의합니다</label></div>
        <button type="submit" class="pdl6-submit">대리점 신청하기</button>
      </form>
    </div>
  </section>`;

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
      <form class="pmt3-card">
        <div class="pmt3-section">
          <div class="stitle">📍 1. 지역·건물 유형</div>
          <div class="pmt3-row split">
            <div><label>지역</label><select><option>선택</option><option>서울</option><option>경기</option><option>인천</option><option>부산</option><option>대구</option><option>광주</option><option>대전</option><option>기타</option></select></div>
            <div><label>건물 유형</label><select><option>선택</option><option>아파트</option><option>관공서</option><option>학교·병원</option><option>상가·오피스</option><option>공장·창고</option><option>주택</option></select></div>
          </div>
        </div>
        <div class="pmt3-section">
          <div class="stitle">🔧 2. 문제·필요한 공법 (복수 선택)</div>
          <div class="pmt3-chips">
            <button type="button" class="pmt3-chip active">옥상 누수</button>
            <button type="button" class="pmt3-chip">외벽 균열</button>
            <button type="button" class="pmt3-chip">지하 누수</button>
            <button type="button" class="pmt3-chip">지하주차장</button>
            <button type="button" class="pmt3-chip">슁글 지붕</button>
            <button type="button" class="pmt3-chip">금속기와</button>
            <button type="button" class="pmt3-chip">결로·곰팡이</button>
            <button type="button" class="pmt3-chip">아스콘·도로</button>
            <button type="button" class="pmt3-chip">기타</button>
          </div>
        </div>
        <div class="pmt3-section">
          <div class="stitle">💰 3. 예상 예산 범위</div>
          <div class="pmt3-budget">
            <div class="pmt3-budget-item"><div class="v">~500</div><div class="l">만원</div></div>
            <div class="pmt3-budget-item active"><div class="v">500-2K</div><div class="l">만원</div></div>
            <div class="pmt3-budget-item"><div class="v">2K-5K</div><div class="l">만원</div></div>
            <div class="pmt3-budget-item"><div class="v">5K-1억</div><div class="l">원</div></div>
            <div class="pmt3-budget-item"><div class="v">1억+</div><div class="l">원</div></div>
          </div>
        </div>
        <div class="pmt3-section">
          <div class="stitle">📝 4. 상세 내용</div>
          <div class="pmt3-row"><label>문제 상황·시급도</label><textarea placeholder="누수 위치, 발생 시기, 진행 정도, 희망 시공 일정 등"></textarea></div>
        </div>
        <div class="pmt3-section">
          <div class="stitle">📞 5. 연락처</div>
          <div class="pmt3-row split">
            <div><label>성함</label><input type="text" placeholder="홍길동"/></div>
            <div><label>연락처</label><input type="text" placeholder="010-0000-0000"/></div>
          </div>
          <div class="pmt3-row"><label>주소 (현장 위치)</label><input type="text" placeholder="○○도 ○○시 ○○로"/></div>
        </div>
        <div class="pmt3-agree"><input type="checkbox" id="ag4"/><label for="ag4">개인정보 수집·이용 및 추천 파트너사 정보 공유에 동의합니다</label></div>
        <button type="submit" class="pmt3-submit">시공 연결 신청하기</button>
      </form>
    </div>
  </section>`;

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
      mkSec('POUR스토어 실적관', SEED_STATS_HTML, '실적 수치 + 시공 갤러리 + 협력사 (기존 cafe24 시안 임베드)', 'requested'),
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
      mkSec('패키지 등급 가이드', SEED_PR_TIER_HTML, '풀패키지(강력추천) / 부분 패키지 / 단순 코팅 3티어 — 각 카드에 시공 영상·설명서·코칭 표시', 'wip'),
      mkSec('베스트 패키지', SEED_PR_BEST_HTML, '4종 풀/부분 패키지 — 랭크·티어 배지 + 자재 조합 표시 + 셀프/시공연결 + 영상·PDF 인디케이터', 'wip'),
      mkSec('신제품', SEED_PR_NEW_HTML, '입고일 표시 + NEW 배지 + 할인 가격 표기', 'wip'),
      mkSec('카테고리별 제품 그리드', SEED_PR_GRID_HTML, '탭 필터 + 카테고리별 그룹(방수/도장/균열) — 각 5개 제품 진열', 'wip'),
      mkSec('시공 가이드 영상', SEED_PR_GUIDE_HTML, '피처 영상 1 + 미니 카드 4 — 매거진 레이아웃 (메인 동영상 가이드와 통일)', 'wip'),
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
