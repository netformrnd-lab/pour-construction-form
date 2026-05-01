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
.ai-rec * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Noto Sans KR', sans-serif; }
.ai-rec { max-width: 1200px; margin: 0 auto; padding: 60px 20px; background: #fff; }
.ai-rec-head { text-align: center; margin-bottom: 28px; }
.ai-rec-head .kicker { display: inline-block; padding: 5px 12px; background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 800; border-radius: 999px; letter-spacing: 1px; }
.ai-rec-head h2 { font-size: 30px; font-weight: 900; color: #0F1F5C; margin: 12px 0 8px; }
.ai-rec-head h2 .accent { color: #03C75A; }
.ai-rec-head p { font-size: 14px; color: #6B7280; }
.ai-rec-filter { background: #F9FAFB; border-radius: 16px; padding: 18px; margin-bottom: 24px; }
.filter-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.filter-row:last-child { margin-bottom: 0; }
.filter-row .label { font-size: 12px; font-weight: 700; color: #0F1F5C; min-width: 60px; }
.filter-row .options { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
.filter-btn { padding: 7px 13px; border: 1.5px solid #E5E7EB; background: #fff; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: #4B5563; cursor: pointer; transition: all .15s; }
.filter-btn:hover { border-color: #03C75A; color: #03C75A; }
.filter-btn.active { background: #03C75A; border-color: #03C75A; color: #fff; }
.ai-chat { background: #fff; border: 1px solid #E5E7EB; border-radius: 16px; padding: 18px; margin-bottom: 28px; box-shadow: 0 1px 4px rgba(0,0,0,.04); }
.ai-chat-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.ai-chat-head .dot { width: 8px; height: 8px; border-radius: 50%; background: #03C75A; box-shadow: 0 0 0 4px rgba(3,199,90,.2); }
.ai-chat-head .name { font-size: 13px; font-weight: 800; color: #0F1F5C; }
.ai-chat-head .status { font-size: 11px; color: #03C75A; font-weight: 700; margin-left: auto; }
.bot-msg { background: #F3F4F6; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.7; color: #111827; max-width: 520px; margin-bottom: 12px; }
.bot-msg b { color: #0F1F5C; }
.quick-replies { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.quick-replies .qr { padding: 8px 13px; background: #fff; border: 1.5px solid #03C75A; color: #03C75A; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; }
.quick-replies .qr:hover { background: #03C75A; color: #fff; }
.chat-input-row { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid #E5E7EB; }
.chat-input-row input { flex: 1; padding: 10px 13px; border: 1px solid #E5E7EB; border-radius: 10px; font-size: 13px; outline: none; }
.chat-input-row button { padding: 10px 20px; background: #0F1F5C; color: #fff; border: 0; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
.result-row { margin-bottom: 32px; }
.result-row h3 { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 900; color: #0F1F5C; margin-bottom: 14px; padding-left: 4px; flex-wrap: wrap; }
.result-row h3 .badge { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 999px; color: #fff; letter-spacing: .5px; }
.result-row h3 .badge.full { background: #DC2626; }
.result-row h3 .badge.partial { background: #D97706; }
.result-row h3 .badge.simple { background: #6B7280; }
.result-row h3 .desc { font-size: 13px; font-weight: 600; color: #4B5563; }
.result-row h3 .count { font-size: 11px; color: #9CA3AF; font-weight: 600; margin-left: auto; }
.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.product-card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; transition: transform .15s, box-shadow .15s, border-color .15s; cursor: pointer; }
.product-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(15,31,92,.12); border-color: #03C75A; }
.product-card .pc-img { aspect-ratio: 1 / 1; background: #F3F4F6 center/cover no-repeat; position: relative; }
.product-card .pc-img .pc-tag { position: absolute; top: 8px; left: 8px; padding: 3px 8px; background: #DC2626; color: #fff; font-size: 10px; font-weight: 800; border-radius: 4px; }
.product-card .pc-body { padding: 11px 12px 13px; }
.product-card .pc-cat { font-size: 10px; font-weight: 700; color: #03C75A; letter-spacing: .5px; text-transform: uppercase; }
.product-card .pc-name { font-size: 13px; font-weight: 700; color: #111827; margin: 4px 0 8px; line-height: 1.4; }
.product-card .pc-price { font-size: 14px; font-weight: 900; color: #0F1F5C; }
.empty-result { text-align: center; padding: 40px 20px; color: #9CA3AF; font-size: 13px; background: #F9FAFB; border-radius: 12px; }
@media (max-width: 640px) {
  .ai-rec { padding: 40px 14px; }
  .ai-rec-head h2 { font-size: 22px; }
  .filter-row { flex-direction: column; align-items: flex-start; }
  .filter-row .label { margin-bottom: 4px; }
  .product-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}
</style>
<section class="ai-rec">
  <div class="ai-rec-head">
    <span class="kicker">AI 맞춤 상품 추천</span>
    <h2>딱 맞는 자재, <span class="accent">AI가 골라드립니다</span></h2>
    <p>시공 부위·건물 유형·현재 상태만 알려주시면 패키지로 정리해드려요</p>
  </div>
  <div class="ai-rec-filter">
    <div class="filter-row">
      <span class="label">시공 부위</span>
      <div class="options" data-filter="cat">
        <button class="filter-btn active" data-val="">전체</button>
        <button class="filter-btn" data-val="슬라브">슬라브</button>
        <button class="filter-btn" data-val="쉬글">쉬글</button>
        <button class="filter-btn" data-val="기와">기와</button>
        <button class="filter-btn" data-val="균열">균열</button>
        <button class="filter-btn" data-val="재도장">재도장</button>
        <button class="filter-btn" data-val="칼라강판/징크">칼라강판/징크</button>
        <button class="filter-btn" data-val="배수로/베란다">배수로/베란다</button>
        <button class="filter-btn" data-val="지하주차장">지하주차장</button>
        <button class="filter-btn" data-val="이음부">이음부</button>
      </div>
    </div>
    <div class="filter-row">
      <span class="label">건물 유형</span>
      <div class="options" data-filter="type">
        <button class="filter-btn active" data-val="">전체</button>
        <button class="filter-btn" data-val="아파트">아파트</button>
        <button class="filter-btn" data-val="일반저층">일반 저층</button>
      </div>
    </div>
  </div>
  <div class="ai-chat">
    <div class="ai-chat-head">
      <span class="dot"></span>
      <span class="name">POUR AI 어시스턴트</span>
      <span class="status">● 온라인</span>
    </div>
    <div class="bot-msg">
      안녕하세요! 어떤 시공이 필요하신가요? <br/>
      <b>1.</b> 시공 부위 (슬라브 옥상, 아스팔트 쉬글, 외벽 등) <br/>
      <b>2.</b> 건물 유형 (아파트, 단독주택, 상가 등) <br/>
      <b>3.</b> 면적 (평 또는 ㎡) <br/>
      <b>4.</b> 현재 상태 (누수 여부, 기존 방수 상태 등)
    </div>
    <div class="quick-replies">
      <button class="qr">제품 구매</button>
      <button class="qr">패키지 구매</button>
      <button class="qr">하자 상담</button>
      <button class="qr">시공 상담</button>
      <button class="qr">작업 도구</button>
    </div>
    <div class="chat-input-row">
      <input type="text" placeholder="자유롭게 상황을 알려주세요. AI가 분석해 추천해드립니다" />
      <button>전송</button>
    </div>
  </div>
  <div id="ai-rec-results"></div>
</section>
<script>
(function(){
  const PRODUCTS = [
    { cat:'슬라브', type:'아파트', tier:'full', name:'슬라브 옥상 풀패키지', price:'980,000원', tag:'BEST', img:'https://placehold.co/300x300/0F1F5C/fff?text=슬라브+풀' },
    { cat:'쉬글', type:'아파트', tier:'full', name:'아스팔트 쉬글 풀패키지', price:'850,000원', img:'https://placehold.co/300x300/B91C1C/fff?text=쉬글+풀' },
    { cat:'기와', type:'아파트', tier:'full', name:'금속기와 풀패키지', price:'1,200,000원', tag:'NEW', img:'https://placehold.co/300x300/059669/fff?text=기와+풀' },
    { cat:'균열', type:'아파트', tier:'full', name:'균열 보수 풀패키지', price:'320,000원', img:'https://placehold.co/300x300/D97706/fff?text=균열+풀' },
    { cat:'재도장', type:'아파트', tier:'full', name:'재도장 풀패키지', price:'680,000원', img:'https://placehold.co/300x300/6D28D9/fff?text=재도장' },
    { cat:'균열', type:'아파트', tier:'partial', name:'코트재 + 크랙시트', price:'180,000원', img:'https://placehold.co/300x300/F59E0B/fff?text=부분보수' },
    { cat:'슬라브', type:'아파트', tier:'partial', name:'슬라브 부분 보수', price:'220,000원', img:'https://placehold.co/300x300/F59E0B/fff?text=부분보수' },
    { cat:'재도장', type:'아파트', tier:'simple', name:'POUR 탑코트재만', price:'120,000원', img:'https://placehold.co/300x300/9CA3AF/fff?text=탑코트재' },
    { cat:'재도장', type:'아파트', tier:'simple', name:'POUR 코트재만', price:'98,000원', img:'https://placehold.co/300x300/9CA3AF/fff?text=코트재' },
    { cat:'쉬글', type:'일반저층', tier:'full', name:'단독주택 쉬글 풀패키지', price:'650,000원', img:'https://placehold.co/300x300/0F1F5C/fff?text=저층+쉬글' },
    { cat:'기와', type:'일반저층', tier:'full', name:'단독주택 기와 풀패키지', price:'820,000원', img:'https://placehold.co/300x300/B91C1C/fff?text=저층+기와' },
    { cat:'슬라브', type:'일반저층', tier:'full', name:'단독주택 슬라브 풀패키지', price:'590,000원', img:'https://placehold.co/300x300/059669/fff?text=저층+슬라브' },
  ];
  const TIERS = [
    { key:'full',    name:'풀패키지',   cls:'full',    desc:'완전 시공 풀세트' },
    { key:'partial', name:'부분 패키지', cls:'partial', desc:'필요 부위만 부분 보수' },
    { key:'simple',  name:'단순 코팅',   cls:'simple',  desc:'코팅재 단품 구매' },
  ];
  const filter = { cat:'', type:'' };
  const root = document.querySelector('.ai-rec');
  const results = root.querySelector('#ai-rec-results');
  function render() {
    results.innerHTML = '';
    const matched = PRODUCTS.filter(p =>
      (!filter.cat || p.cat === filter.cat) &&
      (!filter.type || p.type === filter.type)
    );
    if (matched.length === 0) {
      results.innerHTML = '<div class="empty-result">선택한 조건에 맞는 상품이 없습니다.</div>';
      return;
    }
    TIERS.forEach(tier => {
      const items = matched.filter(p => p.tier === tier.key);
      if (items.length === 0) return;
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = '<h3><span class="badge ' + tier.cls + '">' + tier.name + '</span><span class="desc">' + tier.desc + '</span><span class="count">' + items.length + '개 상품</span></h3><div class="product-grid">' + items.map(function(p){ return '<article class="product-card"><div class="pc-img" style="background-image:url(\\'' + p.img + '\\')">' + (p.tag ? '<span class="pc-tag">' + p.tag + '</span>' : '') + '</div><div class="pc-body"><div class="pc-cat">' + p.cat + ' · ' + p.type + '</div><div class="pc-name">' + p.name + '</div><div class="pc-price">' + p.price + '</div></div></article>'; }).join('') + '</div>';
      results.appendChild(row);
    });
  }
  root.querySelectorAll('.options').forEach(function(group){
    const key = group.dataset.filter;
    group.addEventListener('click', function(e){
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      group.querySelectorAll('.filter-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      filter[key] = btn.dataset.val;
      render();
    });
  });
  render();
})();
<\/script>
`;

  const DEFAULT_PAGES = () => ([
    { id: 'main', name: '메인 페이지', file: 'index.html', sections: [
      mkSec('메인 배너', '', '슬라이드 배너 — 균열·방수·코팅 자재 세트 등 메인 비주얼'),
      mkSec('카테고리 항목 버튼', '', '제품구매·패키지구매·시공상담·시공가이드·쇼룸·부자재·체험교육·파트너사·고객센터 (8~9개 아이콘)'),
      mkSec('AI 맞춤 자재추천', SEED_AI_RECOMMEND_HTML, '챗봇 + 시공부위·건물유형 필터 → 풀패키지/부분/단순 코팅 추천 (초안 v1)'),
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
    requested: { label: '컨펌 요청', icon: '✋', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
    approved:  { label: '승인 완료', icon: '✅', color: '#047857', bg: '#D1FAE5', border: '#6EE7B7' },
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
    if (newStatus === 'requested') {
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
