/* ============================================================
   POUR이야기 · 컨텐츠(고도화) — 섹션 템플릿 + 스타일
   admin.html 의 고도화 편집기가 이 파일을 불러다 씁니다.
   · 큰 이미지는 모두 공용 이미지 편집기(.uie-box) → 편집 방식 통일
   · 글/제목/설명은 모두 클릭 편집(data-editable)
   · 스타일은 전부 .adv-host 안으로 격리 (admin 기존 CSS와 충돌 방지)
   ============================================================ */
(function(){
  window.ADV_EXTRA_CSS = `
/* 섹션 공통 */
.adv-host .adv-sec{margin:0 0 10px;padding:28px 0 4px;border-top:10px solid #f4f4f4;}
.adv-host .adv-sec:first-of-type{border-top:0;padding-top:6px;}
.adv-host .adv-sec-tag{display:inline-block;margin:0 0 14px;padding:4px 10px;border-radius:999px;background:#fff4ea;color:#ff5a00;font-size:11px;font-weight:900;letter-spacing:-.03em;}
/* BEFORE */
.adv-host .comment-card{display:flex;align-items:center;gap:16px;padding:18px 20px;margin-bottom:12px;border-radius:14px;background:linear-gradient(135deg,#fff7f0,#f7f2ee);}
.adv-host .comment-card .uie-box{flex:0 0 104px;width:104px;height:104px;margin:0;border-radius:12px;box-shadow:none;}
.adv-host .comment-title{margin:0 0 6px;color:#ff5a00;font-size:18px;font-weight:850;letter-spacing:-.035em;}
.adv-host .comment-text{margin:0;font-size:15px;line-height:1.55;font-weight:700;color:#333;word-break:keep-all;}
.adv-host .sec-title{margin:0 0 5px;font-size:22px;line-height:1.25;font-weight:900;color:#111;letter-spacing:-.04em;}
.adv-host .sec-title strong{color:#ff5a00;margin-right:6px;}
.adv-host .sec-sub{margin:0 0 14px;font-size:14px;line-height:1.4;color:#9a9a9a;font-weight:700;letter-spacing:-.03em;}
.adv-host .detail-item{margin-top:22px;padding-top:20px;border-top:1px solid #eee;}
.adv-host .detail-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.adv-host .num{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#ff5a00;color:#fff;font-size:14px;font-weight:900;flex:0 0 30px;}
.adv-host .detail-title{margin:0;font-size:18px;font-weight:900;color:#222;letter-spacing:-.03em;}
.adv-host .detail-text{margin:10px 0 0;font-size:15px;line-height:1.6;font-weight:700;color:#333;word-break:keep-all;letter-spacing:-.03em;}
.adv-host .point-summary{margin-top:22px;padding:20px 18px;border-radius:8px;background:linear-gradient(90deg,#fff9f1,#fffdf9 48%,#f8f8f8);box-shadow:0 8px 22px rgba(0,0,0,.04);}
.adv-host .summary-title{margin:0 0 9px;color:#ff5a00;font-size:18px;font-weight:950;letter-spacing:-.04em;}
.adv-host .summary-list{margin:0;padding:0 0 0 16px;}
.adv-host .summary-list li{margin:0 0 6px;color:#222;font-size:14px;line-height:1.45;font-weight:700;letter-spacing:-.03em;}
.adv-host .summary-list strong{color:#ff5a00;font-weight:950;}
.adv-host .goal-note{margin-top:14px;padding:16px 18px;border-radius:6px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.1);}
.adv-host .goal-title{margin:0 0 9px;padding-bottom:7px;border-bottom:1px solid #e5e5e5;font-size:14px;font-weight:950;letter-spacing:-.04em;}
.adv-host .goal-list{margin:0;padding:0;list-style:none;}
.adv-host .goal-list li{display:flex;gap:7px;margin-bottom:7px;color:#333;font-size:13px;font-weight:800;letter-spacing:-.03em;}
.adv-host .goal-list .check{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;flex:0 0 15px;border:1.5px solid #b7b7b7;color:#ff5a00;font-size:11px;font-weight:900;}
/* 시공과정 STEP */
.adv-host .step{padding:0 0 28px;margin-bottom:24px;border-bottom:1px solid #eee;}
.adv-host .step:last-of-type{border-bottom:0;}
.adv-host .eyebrow{font-size:14px;font-weight:900;color:#ff5a00;margin-bottom:3px;}
.adv-host .step h3{margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:900;letter-spacing:-.05em;}
.adv-host .used-title{font-size:15px;margin:16px 0 12px;font-weight:800;color:#333;}
.adv-host .products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
.adv-host .product{display:grid;grid-template-rows:auto auto;justify-items:center;gap:8px;min-height:150px;padding:16px 12px;border:1px solid #e6e6e6;border-radius:12px;text-decoration:none;color:#222;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.03);font-weight:800;text-align:center;}
.adv-host .product img{width:78px;height:70px;object-fit:contain;}
.adv-host .product span{font-size:14px;line-height:1.25;letter-spacing:-.04em;}
.adv-host .point{display:flex;gap:16px;align-items:flex-start;margin-top:10px;padding:22px 24px;border-radius:8px;background:#fff8f3;box-shadow:0 8px 22px rgba(0,0,0,.05);}
.adv-host .point .bulb{font-size:30px;flex:0 0 auto;}
.adv-host .point h4{margin:0 0 8px;color:#ff5a00;font-size:19px;font-weight:900;}
.adv-host .point p{margin:0;color:#333;font-size:17px;font-weight:650;letter-spacing:-.035em;}
.adv-host .after-title{display:flex;align-items:baseline;gap:10px;margin:24px 0 6px;}
.adv-host .after-title strong{color:#ff5a00;font-size:24px;font-weight:900;letter-spacing:-.04em;}
.adv-host .after-title h2{margin:0;font-size:22px;font-weight:900;letter-spacing:-.04em;}
.adv-host .after-sub{margin:0 0 16px;color:#333;font-size:15px;line-height:1.55;}
/* 사용제품 리스트 */
.adv-host .used-track{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 8px;}
.adv-host .used-card{flex:0 0 230px;display:flex;align-items:center;gap:12px;padding:13px 14px;background:#fff;border:1px solid #e9e9e9;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,.05);text-decoration:none;color:#111;}
.adv-host .used-card img{width:72px;height:72px;object-fit:contain;flex:0 0 72px;}
.adv-host .used-card strong{display:block;font-size:13.5px;font-weight:900;line-height:1.23;letter-spacing:-.04em;}
.adv-host .used-card .u-sub{display:block;margin-top:3px;font-size:11.5px;font-weight:700;color:#444;}
.adv-host .used-card .u-price{margin:4px 0 0;font-size:13px;font-weight:900;color:#ff5a00;}
/* 견적노트 */
.adv-host .estimate-card{padding:26px 24px;border:1px solid #e8e8e8;border-radius:16px;background:linear-gradient(135deg,#fff,#fffaf5);box-shadow:0 8px 24px rgba(0,0,0,.05);}
.adv-host .estimate-title{margin:0 0 18px;font-size:23px;font-weight:900;letter-spacing:-.045em;}
.adv-host .estimate-title .ic{margin-right:8px;}
.adv-host .estimate-block-title{margin:0 0 14px;padding-left:12px;border-left:3px solid #ff5a00;font-size:17px;font-weight:900;letter-spacing:-.04em;}
.adv-host .material-list{border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;background:#fff;}
.adv-host .material-row{display:grid;grid-template-columns:64px minmax(0,1fr);align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid #eee;}
.adv-host .material-row:last-child{border-bottom:0;}
.adv-host .material-row .uie-box{width:58px;height:58px;margin:0;border-radius:12px;box-shadow:none;}
.adv-host .material-name{margin:0 0 4px;font-size:15px;font-weight:900;letter-spacing:-.04em;}
.adv-host .material-sub{margin:0;color:#777;font-size:12.5px;font-weight:600;letter-spacing:-.03em;}
/* 후기 */
.adv-host .review-card{padding:28px 30px;border-radius:16px;background:linear-gradient(135deg,#fff9f1,#fffdf9 50%,#f8f8f8);border:1px solid rgba(0,0,0,.06);box-shadow:0 10px 28px rgba(0,0,0,.045);}
.adv-host .review-title{margin:0 0 18px;font-size:24px;font-weight:950;letter-spacing:-.05em;color:#111;}
.adv-host .review-text{margin:0;font-size:16px;line-height:1.85;font-weight:700;letter-spacing:-.035em;color:#333;word-break:keep-all;}
.adv-host .review-text strong{color:#ff5a00;font-weight:950;background:linear-gradient(transparent 58%,rgba(255,90,0,.16) 58%);}
.adv-host .review-sign{margin:20px 4px 0 0;text-align:right;font-size:15px;font-weight:800;color:#333;letter-spacing:-.03em;}
/* 연관상품 */
.adv-host .related-head{display:flex;align-items:center;gap:8px;margin-bottom:16px;}
.adv-host .related-head h2{margin:0;color:#00164f;font-size:22px;font-weight:950;letter-spacing:-.045em;}
.adv-host .related-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
.adv-host .related-card{display:flex;flex-direction:column;border:1px solid #e5e8ef;border-radius:12px;overflow:hidden;background:#fff;text-decoration:none;color:#111;box-shadow:0 4px 12px rgba(0,0,0,.025);}
.adv-host .related-card .rimg{height:150px;background:#f6f6f6;overflow:hidden;}
.adv-host .related-card .rimg img{width:100%;height:100%;object-fit:cover;}
.adv-host .related-body{padding:10px 12px 12px;}
.adv-host .related-cat{display:block;margin-bottom:4px;color:#9a9a9a;font-size:11px;font-weight:800;}
.adv-host .related-name{margin:0 0 8px;color:#00164f;font-size:13.5px;font-weight:900;line-height:1.35;letter-spacing:-.045em;word-break:keep-all;}
.adv-host .related-price .r-final{color:#000;font-size:17px;font-weight:950;letter-spacing:-.045em;}
.adv-host .related-price .r-rate{color:#ff4b3e;font-size:14px;font-weight:900;margin-right:5px;}
/* 댓글 */
.adv-host .post-action-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-bottom:20px;border-bottom:1px solid #e8e8e8;}
.adv-host .post-action-btn{height:46px;border:1px solid #e2e5ec;border-radius:9px;background:#fff;color:#263044;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:6px;}
.adv-host .comment-hd{margin:22px 0 14px;font-size:19px;font-weight:950;color:#06164a;letter-spacing:-.045em;}
.adv-host .comment-hd span{color:#ff5a00;}
.adv-host .comment-item{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;margin-bottom:16px;}
.adv-host .c-avatar{width:36px;height:36px;border-radius:50%;background:#8b93a3;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:950;}
.adv-host .c-avatar.o{background:#ff5a00;}.adv-host .c-avatar.g{background:#08b66b;}.adv-host .c-avatar.p{background:#7c3bec;}
.adv-host .c-name{color:#06164a;font-weight:950;font-size:13px;margin-right:5px;}
.adv-host .c-time{color:#8b92a2;font-weight:800;font-size:12px;}
.adv-host .c-text{margin:3px 0 0;color:#263044;font-size:14px;line-height:1.6;font-weight:650;letter-spacing:-.03em;word-break:keep-all;}
.adv-host .case-hd{margin:26px 0 16px;color:#06164a;font-size:20px;font-weight:950;letter-spacing:-.045em;}
.adv-host .case-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
.adv-host .case-card{border:1px solid #e4e7ee;border-radius:10px;overflow:hidden;background:#fff;text-decoration:none;color:#06164a;box-shadow:0 4px 12px rgba(0,0,0,.025);}
.adv-host .case-card .uie-box{height:106px;margin:0;border-radius:0;box-shadow:none;}
.adv-host .case-body{padding:10px 11px 12px;}
.adv-host .case-cat{display:block;margin-bottom:4px;color:#ff5a00;font-size:11px;font-weight:950;}
.adv-host .case-name{margin:0;color:#06164a;font-size:13px;line-height:1.35;font-weight:950;letter-spacing:-.04em;word-break:keep-all;}
@media(max-width:640px){
  .adv-host .products,.adv-host .related-grid,.adv-host .case-grid{grid-template-columns:repeat(2,1fr);}
  .adv-host .post-action-bar{grid-template-columns:1fr;}
  .adv-host .comment-card{flex-direction:column;align-items:flex-start;}
}
/* 상품/설명 점(핫스팟) */
.adv-host .uie-point{position:absolute;transform:translate(-50%,-50%);z-index:60;width:24px;height:24px;border-radius:50%;background:#ff5a00;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:grab;box-shadow:0 3px 10px rgba(0,0,0,.3);border:2px solid #fff;touch-action:none;}
.adv-host .uie-point.info{background:#169cff;}
.adv-host .uie-point:active{cursor:grabbing;}
.adv-host .uie-pop{position:absolute;z-index:85;width:min(240px,calc(100% - 20px));transform:translate(-50%,10px);background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.22);padding:12px;}
.adv-host .uie-pop-tabs{display:flex;gap:6px;align-items:center;margin-bottom:8px;}
.adv-host .uie-pt{border:1px solid #ddd;border-radius:7px;background:#f7f7f7;color:#333;font:inherit;font-size:12px;font-weight:900;padding:6px 12px;cursor:pointer;}
.adv-host .uie-pt.on{border-color:#ff5a00;background:#ff5a00;color:#fff;}
.adv-host .uie-pop-x{margin-left:auto;width:26px;height:26px;border:0;border-radius:50%;background:#f1f1f1;color:#555;font-size:16px;line-height:1;cursor:pointer;}
.adv-host .uie-pop-body{display:grid;gap:3px;}
.adv-host .uie-pop-body label{font-size:11px;font-weight:850;color:#555;margin-top:5px;}
.adv-host .uie-pop-del{margin-top:10px;width:100%;border:0;border-radius:8px;background:#fff0ec;color:#e5484d;font:inherit;font-size:12px;font-weight:900;padding:8px;cursor:pointer;}
/* 외곽선(강조 영역) — 톡톡 점찍기 방식 */
.adv-host .uie-hl-svg{position:absolute;inset:0;z-index:58;pointer-events:none;overflow:visible;}
.adv-host .uie-hl-svg polyline{fill:none;stroke:#ff5a00;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;}
.adv-host .uie-hl-svg polyline.done{stroke-opacity:.85;}
.adv-host .uie-hl-svg polyline.draw{stroke-dasharray:5 4;stroke-opacity:1;}
.adv-host .uie-dot{position:absolute;transform:translate(-50%,-50%);z-index:62;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #ff5a00;color:#ff5a00;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.25);}
.adv-host .uie-hint{position:absolute;left:8px;top:8px;z-index:64;background:rgba(255,90,0,.94);color:#fff;font-size:11px;font-weight:800;padding:4px 9px;border-radius:6px;pointer-events:none;}
.adv-host .uie-hl-wrap{margin-top:12px;}
.adv-host .uie-hl-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}
.adv-host .uie-hl-head>span{font-size:12px;font-weight:900;color:#ff5a00;}
.adv-host .uie-hl-btns{display:flex;gap:6px;}
.adv-host .uie-mini{border:1px solid #ddd;border-radius:7px;background:#f7f7f7;color:#333;font:inherit;font-size:11px;font-weight:900;padding:5px 10px;cursor:pointer;}
.adv-host .uie-mini.on{border-color:#ff5a00;background:#ff5a00;color:#fff;}
.adv-host .uie-mini.line{border-color:#ff8a3d;background:#fff4ea;color:#ff5a00;}
.adv-host .uie-mini.del{border-color:#f3c0c0;background:#fff;color:#e5484d;}
.adv-host .uie-hl-tip{margin:0 0 8px;font-size:11px;color:#777;font-weight:700;}
.adv-host .uie-hl-item{margin-top:8px;padding:10px;border:1px solid #eee;border-radius:10px;background:#fafafa;}
.adv-host .uie-hl-itop{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.adv-host .uie-hl-itop b{font-size:11.5px;color:#ff5a00;}
/* ===== 편집 사용성 개선 ===== */
/* 편집창: 이미지 크기와 무관하게 고정 폭 + 스크롤(아래 안 잘림) */
.adv-host .uie-panel{width:min(300px,86vw);max-height:min(62vh,460px);overflow:auto;}
.adv-host .uie-pop{width:min(240px,82vw);}
/* 작은 이미지(댓글·자재·사례 썸네일): '이미지 변경(URL/업로드)'만, 고급도구 숨김 */
.adv-host .comment-card .uie-adv-only,.adv-host .material-row .uie-adv-only,.adv-host .case-card .uie-adv-only{display:none;}
.adv-host .comment-card .uie-handle,.adv-host .material-row .uie-handle,.adv-host .case-card .uie-handle,
.adv-host .comment-card .uie-badge,.adv-host .material-row .uie-badge,.adv-host .case-card .uie-badge{display:none !important;}
.adv-host .comment-card .uie-open,.adv-host .material-row .uie-open,.adv-host .case-card .uie-open{left:6px;top:6px;padding:5px 8px;font-size:12px;}
/* 편집 가능한 글자: 은은한 점선으로 '여기 클릭해 수정' 힌트 */
.adv-host [data-editable="true"]{box-shadow:inset 0 -1px 0 rgba(255,138,61,.35);}
.adv-host [data-editable="true"]:hover,.adv-host [data-editable="true"]:focus{box-shadow:0 0 0 2px rgba(255,90,0,.25);}
/* ===== 섹션 추가/삭제/이동 ===== */
.adv-host .adv-sec{position:relative;}
.adv-host .adv-sec-bar{position:absolute;right:0;top:4px;z-index:40;display:flex;gap:4px;}
.adv-host .adv-sec-bar button{border:1px solid #e2e2e2;border-radius:7px;background:#fff;color:#666;font:inherit;font-size:11px;font-weight:900;padding:4px 8px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08);}
.adv-host .adv-sec-bar button:hover{background:#fff4ea;color:#ff5a00;border-color:#ff8a3d;}
.adv-host .adv-sec-bar .adv-sec-del{color:#e5484d;border-color:#f3c0c0;}
.adv-host .adv-addsec{position:relative;margin:20px 0 6px;text-align:center;}
.adv-host .adv-addsec-btn{border:1.5px dashed #ff8a3d;border-radius:10px;background:#fff8f3;color:#ff5a00;font:inherit;font-size:13px;font-weight:900;padding:11px 20px;cursor:pointer;}
.adv-host .adv-addsec-btn:hover{background:#fff1e7;}
.adv-host .adv-sec-menu{display:none;position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);z-index:90;width:min(280px,90vw);max-height:260px;overflow:auto;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.2);padding:8px;}
.adv-host .adv-sec-menu.open{display:block;}
.adv-host .adv-sec-menu button{display:block;width:100%;text-align:left;border:0;border-radius:8px;background:#fff;color:#333;font:inherit;font-size:12.5px;font-weight:800;padding:9px 10px;cursor:pointer;}
.adv-host .adv-sec-menu button:hover{background:#fff4ea;color:#ff5a00;}
`;

  var IMG = {
    thumb:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%8D%B8%EB%84%A4%EC%9D%BC%EC%9D%B4%EB%AF%B8%EC%A7%80.png?alt=media&token=995d4fcc-bbfb-4fcf-b223-d45785b0829c',
    before:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EB%B9%84%ED%8F%AC%EC%9D%B4%EB%AF%B8%EC%A7%80%201.png?alt=media&token=b96f79c1-8e28-4463-a28a-7b9317a7364b',
    step1:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%8A%A4%ED%85%9D1.png?alt=media&token=c5c1cc03-2809-4336-a739-cc404fbfeb1e',
    step2:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%9D%B4%EC%9D%8C%EB%B6%80%20%EB%B3%B4%EA%B0%95.png?alt=media&token=cceb4510-0905-4a7e-964e-7a3e33559e7f',
    step3:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%8A%A4%ED%85%9D3.png?alt=media&token=974e9d6c-af90-4ee9-9df1-da77116f7967',
    coat:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%BD%94%ED%8A%B8%EC%9E%AC.png?alt=media&token=ab67ed9f-af89-4865-ae9a-b4a0966c6dae',
    sheet:'https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%9D%B4%EC%9D%8C%EB%B6%80%EC%8B%9C%ED%8A%B8.png?alt=media&token=dd48bf23-e2b9-4219-a943-abcb85197898'
  };
  function box(src,alt){ return '<div class="uie-box"><img src="'+src+'" alt="'+(alt||'')+'"></div>'; }
  function ed(cls,tag,txt){ tag=tag||'div'; return '<'+tag+' class="'+cls+'" contenteditable="true" data-editable="true">'+txt+'</'+tag+'>'; }

  window.ADV_DEFAULT_HTML = `
<!-- ① 포스팅 헤더 -->
<div class="adv-sec"><span class="adv-sec-tag">① 헤더</span>
  ${ed('breadcrumb','p','POUR 아스팔트 &gt; 지붕 싱글코팅')}
  <div class="chips">
    <span class="chip"><span contenteditable="true" data-editable="true">아스팔트 슁글 지붕</span><button type="button" class="delete-chip">×</button></span>
    <span class="chip"><span contenteditable="true" data-editable="true">셀프 시공</span><button type="button" class="delete-chip">×</button></span>
    <button type="button" class="chip-add-tile" aria-label="태그 추가"><span></span></button>
  </div>
  ${box(IMG.thumb,'대표 이미지')}
  <div class="adv-textblocks">
    <div class="content-block"><button type="button" class="delete-block">×</button>${ed('title','h1','30년 된 아스팔트 싱글 지붕, 철거 없이 복원한 방법')}</div>
    <div class="content-block"><button type="button" class="delete-block">×</button>${ed('desc','p','노후된 아스팔트 슁글 지붕을 POUR 방수코팅제로 복원한 실제 시공 사례입니다.')}</div>
  </div>
  <button type="button" class="text-add-tile" aria-label="글 추가"><span></span></button>
  <div class="cards-area"><section class="info-card"><button type="button" class="delete-info-card">×</button><div class="info-grid">
    <div class="info-item"><button type="button" class="delete-info-item">×</button>${ed('info-label','div','건물유형')}${ed('info-value','div','단독주택')}</div>
    <div class="info-item"><button type="button" class="delete-info-item">×</button>${ed('info-label','div','면적')}${ed('info-value','div','30평')}</div>
    <div class="info-item"><button type="button" class="delete-info-item">×</button>${ed('info-label','div','시공방식')}${ed('info-value','div','셀프 시공')}</div>
    <div class="info-item"><button type="button" class="delete-info-item">×</button>${ed('info-label','div','지붕자재')}${ed('info-value','div','아스팔트 지붕')}</div>
    <div class="info-item"><button type="button" class="delete-info-item">×</button>${ed('info-label','div','위치')}${ed('info-value','div','경기도 분당시')}</div>
    <button type="button" class="info-add-tile addInfoItem" aria-label="항목 추가"><span></span></button>
  </div></section></div>
</div>

<!-- ② BEFORE -->
<div class="adv-sec"><span class="adv-sec-tag">② BEFORE 현장진단</span>
  <div class="comment-card">${box('https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EA%B4%80%EB%A6%AC%EC%86%8C%EC%9E%A5%EC%95%84%EC%A0%80%EC%94%A8.png?alt=media&token=0913cf3a-a607-4d1b-b2a0-58dbbefd65b2','관리소장')}<div>${ed('comment-title','h2','관리소장 문의 내용')}${ed('comment-text','p','비 오는 날마다 한 동에서만 누수가 발생했습니다. 균열 있는 부분만 직접 보수할 방법을 찾다가 POUR 방수공법을 알게 됐습니다.')}</div></div>
  <div class="sec-title"><strong contenteditable="true" data-editable="true">BEFORE</strong> ${ed('','span','시공 전 현장 상태')}</div>
  ${ed('sec-sub','p','누수 발생 부위 확인 및 문제점 분석')}
  ${box(IMG.before,'시공 전 지붕 전경')}
  <div class="detail-item"><div class="detail-head"><span class="num">01</span>${ed('detail-title','h3','싱글 탈락 부위')}</div>${box('https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%8A%81%EA%B8%80%ED%83%88%EB%9D%BD%201.png?alt=media&token=8fb0d2cf-88f9-4896-a6f6-484bb8f5dea6','싱글 탈락')}${ed('detail-text','p','슁글 탈락으로 방수층이 노출된 상태였습니다. 전용 보강 시트와 코트재로 손상 부위를 보강하고 방수 성능을 회복합니다.')}</div>
  <div class="detail-item"><div class="detail-head"><span class="num">02</span>${ed('detail-title','h3','벤추레이터 주변 균열')}</div>${box('https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%9D%B4%EC%9D%8C%EB%B6%80%20%EA%B7%A0%EC%97%B4.png?alt=media&token=74777c65-192f-4922-80f7-3f5a8b17806b','이음부 균열')}${ed('detail-text','p','이음부에 노후화로 인한 균열이 확인되었습니다. 우천 시 빗물 침투가 발생할 수 있는 구간입니다.')}</div>
  <div class="point-summary">${ed('summary-title','h2','포인트 요약')}<ul class="summary-list"><li contenteditable="true" data-editable="true">전체 노후화와 국부적 <strong>균열·탈락</strong>이 누수 원인</li><li contenteditable="true" data-editable="true">부위별 맞춤 보수로 부분 복구 가능</li></ul>
    <div class="goal-note">${ed('goal-title','h3','작업 목표')}<ul class="goal-list"><li><span class="check">✓</span><span contenteditable="true" data-editable="true">누수 발생 부위 막기</span></li><li><span class="check">✓</span><span contenteditable="true" data-editable="true">전체 철거 없이 비용 절감</span></li></ul></div>
  </div>
</div>

<!-- ③ 시공과정 -->
<div class="adv-sec"><span class="adv-sec-tag">③ 시공과정</span>
  <div class="sec-title"><strong contenteditable="true" data-editable="true">시공 과정</strong> ${ed('','span','문제 부위만 선별 보수')}</div>
  <div class="step">${ed('eyebrow','div','STEP 1')}${ed('','h3','문제 부위 정리 및 청소')}${box(IMG.step1,'STEP1')}${ed('detail-text','p','지붕 표면의 먼지·이끼·곰팡이 등 오염물을 제거합니다. 고소 작업 시 안전장비를 반드시 착용합니다.')}
    ${ed('used-title','p','사용 제품')}<div class="products"><a class="product" href="#"><img src="https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%95%88%EC%A0%84%EB%AA%A8.png?alt=media&token=9d651d8d-9fac-4a71-8880-8cf1ef9cbb96" alt=""><span contenteditable="true" data-editable="true">고급 경량 안전모</span></a></div>
  </div>
  <div class="step">${ed('eyebrow','div','STEP 2')}${ed('','h3','균열 보수 및 방수 시트 시공')}${box(IMG.step2,'STEP2')}${ed('detail-text','p','탈락·들뜬 부위에 코트재를 도포하고 전용 보강 시트를 밀착 부착해 빈틈 없이 보강합니다.')}
    ${ed('used-title','p','사용 제품')}<div class="products"><a class="product" href="#"><img src="${IMG.coat}" alt=""><span contenteditable="true" data-editable="true">POUR 코트재</span></a><a class="product" href="#"><img src="${IMG.sheet}" alt=""><span contenteditable="true" data-editable="true">POUR 슈퍼복합 방수시트</span></a></div>
  </div>
  <div class="step">${ed('eyebrow','div','STEP 3')}${ed('','h3','방수층 형성 및 마감 코팅')}${box(IMG.step3,'STEP3')}${ed('detail-text','p','방수액 도포 후 전용 시트를 부착하고, 코트재를 2회 이상 도포해 탄탄한 방수층을 형성합니다.')}</div>
  <div class="point"><span class="bulb">💡</span><div>${ed('','h4','시공 포인트')}${ed('','p','문제 부위만 선별 보수하여 전체 교체 대비 비용과 시간을 절감했습니다.')}</div></div>
  <div class="after-title"><strong contenteditable="true" data-editable="true">AFTER</strong>${ed('','h2','시공 완료 후 모습')}</div>
  ${ed('after-sub','p','보수 후 깔끔하게 마감된 지붕 전체 모습입니다.')}
  ${box(IMG.thumb,'시공 완료 후')}
</div>

<!-- ④ 사용 제품 리스트 -->
<div class="adv-sec"><span class="adv-sec-tag">④ 사용 제품 리스트</span>
  ${ed('sec-title','h2','사용 제품 리스트')}
  <div class="used-track">
    <a class="used-card" href="#"><img src="${IMG.coat}" alt=""><div><strong contenteditable="true" data-editable="true">POUR 코트재</strong><span class="u-sub" contenteditable="true" data-editable="true">20kg</span><p class="u-price" contenteditable="true" data-editable="true">177,500원</p></div></a>
    <a class="used-card" href="#"><img src="${IMG.sheet}" alt=""><div><strong contenteditable="true" data-editable="true">POUR 슈퍼복합 방수시트</strong><span class="u-sub" contenteditable="true" data-editable="true">0.3T</span><p class="u-price" contenteditable="true" data-editable="true">48,500원</p></div></a>
  </div>
</div>

<!-- ⑤ 견적 노트 -->
<div class="adv-sec"><span class="adv-sec-tag">⑤ 견적 노트</span>
  <div class="estimate-card">${ed('estimate-title','h2','<span class="ic">🧾</span>견적 노트')}${ed('estimate-block-title','h3','사용 자재 내역')}
    <div class="material-list">
      <div class="material-row">${box(IMG.coat,'')}<div>${ed('material-name','p','POUR 코트재')}${ed('material-sub','p','방수층 형성 및 표면 코팅 마감용 자재')}</div></div>
      <div class="material-row">${box(IMG.sheet,'')}<div>${ed('material-name','p','POUR 슈퍼복합 방수시트')}${ed('material-sub','p','균열·이음부 보강용 복합 방수시트')}</div></div>
    </div>
  </div>
</div>

<!-- ⑥ 시공 후기 -->
<div class="adv-sec"><span class="adv-sec-tag">⑥ 시공 후기</span>
  <div class="review-card">${ed('review-title','h2','관리소장 후기')}${ed('review-text','p','작년 장마철 옥상 누수로 민원이 계속됐는데, <strong>문제 구간만 빠르게 보수</strong>했습니다. 작업 시간도 짧았고 <strong>비용도 훨씬 적게 들어</strong> 만족합니다.')}${ed('review-sign','p','- ○○아파트 관리소장')}</div>
</div>

<!-- ⑦ 연관 상품 -->
<div class="adv-sec"><span class="adv-sec-tag">⑦ 함께 보면 좋은 상품</span>
  <div class="related-head"><h2 contenteditable="true" data-editable="true">함께 보면 좋은 상품</h2></div>
  <div class="related-grid">
    <a class="related-card" href="#"><div class="rimg"><img src="https://cdn.imweb.me/thumbnail/20240919/f1fad44549c6b.jpg" alt=""></div><div class="related-body"><span class="related-cat" contenteditable="true" data-editable="true">프라이머</span><p class="related-name" contenteditable="true" data-editable="true">옥상/지붕 셀프 방수 프라이머 POUR 강화재</p><div class="related-price"><span class="r-rate" contenteditable="true" data-editable="true">8%</span><strong class="r-final" contenteditable="true" data-editable="true">180,000원</strong></div></div></a>
    <a class="related-card" href="#"><div class="rimg"><img src="https://cdn.imweb.me/thumbnail/20230819/04b6da7564e04.jpg" alt=""></div><div class="related-body"><span class="related-cat" contenteditable="true" data-editable="true">후레싱 고정</span><p class="related-name" contenteditable="true" data-editable="true">아스팔트 싱글 후레싱 고정 POUR후커</p><div class="related-price"><span class="r-rate" contenteditable="true" data-editable="true">23%</span><strong class="r-final" contenteditable="true" data-editable="true">7,600원</strong></div></div></a>
  </div>
</div>

<!-- ⑧ 댓글 · 연관 포스팅 -->
<div class="adv-sec"><span class="adv-sec-tag">⑧ 댓글 · 다른 시공사례</span>
  <div class="post-action-bar"><div class="post-action-btn">❤ 좋아요 <span contenteditable="true" data-editable="true">284</span></div><div class="post-action-btn">🔖 북마크 <span contenteditable="true" data-editable="true">156</span></div><div class="post-action-btn">↗ 공유</div></div>
  <h2 class="comment-hd">댓글 <span contenteditable="true" data-editable="true">42</span></h2>
  <div class="comment-item"><div class="c-avatar o">서</div><div><div><span class="c-name" contenteditable="true" data-editable="true">서연맘</span><span class="c-time">3시간 전</span></div>${ed('c-text','p','부분 보수 방식이면 공사 기간이 짧아서 좋겠네요. 비 오기 전에도 시공 가능할까요?')}</div></div>
  <div class="comment-item"><div class="c-avatar g">하</div><div><div><span class="c-name" contenteditable="true" data-editable="true">하루의집</span><span class="c-time">5시간 전</span></div>${ed('c-text','p','후레싱 이음부 보강까지 들어가는 게 마음에 들어요.')}</div></div>
  <h2 class="case-hd">이 포스트와 어울리는 다른 시공사례</h2>
  <div class="case-grid">
    <a class="case-card" href="#">${box('https://firebasestorage.googleapis.com/v0/b/pour-app-new.firebasestorage.app/o/POUR%EC%8A%A4%ED%86%A0%EC%96%B4%20%EC%BB%A8%ED%85%90%EC%B8%A0%2FPOUR%EA%B3%B5%EB%B2%95%2F%ED%8F%AC%EC%8A%A4%ED%8C%85%2F%EC%9D%B4%EC%9D%8C%EB%B6%80%20%EB%B3%B4%EA%B0%95.png?alt=media&token=cceb4510-0905-4a7e-964e-7a3e33559e7f','')}<div class="case-body"><span class="case-cat" contenteditable="true" data-editable="true">후레싱 보강</span><p class="case-name" contenteditable="true" data-editable="true">후레싱 이음부 균열 보수 시공</p></div></a>
    <a class="case-card" href="#">${box(IMG.step3,'')}<div class="case-body"><span class="case-cat" contenteditable="true" data-editable="true">방수 코팅</span><p class="case-name" contenteditable="true" data-editable="true">노후 지붕 방수층 재도장 사례</p></div></a>
  </div>
</div>`;
  // 섹션 목록(추가 메뉴용): 기본 템플릿을 섹션 단위로 분해
  (function(){
    try{
      var _t=document.createElement('div'); _t.innerHTML=window.ADV_DEFAULT_HTML;
      window.ADV_SECTIONS=Array.prototype.slice.call(_t.children)
        .filter(function(el){ return el.classList && el.classList.contains('adv-sec'); })
        .map(function(el){ var tag=el.querySelector('.adv-sec-tag'); return { label: tag?tag.textContent.trim():'섹션', html: el.outerHTML }; });
    }catch(e){ window.ADV_SECTIONS=[]; }
  })();
})();
