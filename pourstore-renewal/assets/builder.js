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

  const DEFAULT_PAGES = () => ([
    { id: 'main', name: '메인 페이지', file: 'index.html', sections: [
      mkSec('section-stats', SEED_STATS_HTML, '실적 수치 + 시공 갤러리 + 협력사 (기존 cafe24 시안)'),
      mkSec('메인 배너', '', ''),
      mkSec('카테고리 항목 버튼', '', ''),
      mkSec('AI챗봇 맞춤 상품안내', '', ''),
      mkSec('인기 추천 상품', '', ''),
      mkSec('서브카테고리 상품', '', ''),
      mkSec('유튜브 숏츠 연결', '', ''),
      mkSec('서비스 소개', '', ''),
      mkSec('자사몰 내 포스팅', '', ''),
      mkSec('시공방법 영상', '', ''),
      mkSec('POUR솔루션 영상', '', ''),
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
  function mkSec(name, html, note) {
    return {
      id: genId(),
      name,
      html: html || '',
      note: note || '',
      confirmed: false,
      confirmedAt: null,
    };
  }
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
        state.activePageId = p.id; saveState(); renderAll();
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
      card.className = 'section-card' + (s.confirmed ? ' confirmed' : '');
      card.draggable = true;
      card.dataset.sectionId = s.id;
      const hasHtml = s.html && s.html.trim().length > 0;
      const histLen = (state.history[histKey(page.id, s.id)] || []).length;
      const confirmTitle = s.confirmed
        ? `컨펌 완료 (${fmtDate(s.confirmedAt)}) — 클릭하면 해제`
        : '컨펌 완료로 표시';
      card.innerHTML = `
        <div class="grip" title="드래그해서 순서 변경">⋮⋮</div>
        <button class="confirm-toggle ${s.confirmed ? 'on' : ''}" data-act="confirm" title="${escapeHtml(confirmTitle)}" aria-label="컨펌 토글"></button>
        <div class="order">${idx + 1}</div>
        <div class="info">
          <div class="name">
            <span>${escapeHtml(s.name)}</span>
            <span class="badge ${hasHtml ? 'ready' : 'empty'}">${hasHtml ? 'READY' : 'EMPTY'}</span>
            ${s.confirmed ? '<span class="badge confirmed">✓ 컨펌</span>' : ''}
            ${histLen ? `<span class="badge">v${histLen}</span>` : ''}
          </div>
          <div class="meta">${escapeHtml(s.note || '메모 없음')}</div>
        </div>
        <div class="controls">
          ${hasHtml ? '<button class="btn btn-sm btn-outline" data-act="copy" title="HTML 코드 복사">HTML 복사</button>' : ''}
          <button class="btn btn-sm btn-ghost" data-act="preview">미리보기</button>
          <button class="btn btn-sm btn-outline" data-act="history">이력</button>
          <button class="btn btn-sm btn-primary" data-act="edit">편집</button>
          <button class="btn btn-sm btn-danger" data-act="delete" title="삭제">×</button>
        </div>
      `;
      card.querySelector('[data-act=confirm]').addEventListener('click', e => { e.stopPropagation(); toggleConfirm(s.id); });
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
  function toggleConfirm(secId) {
    const page = getActivePage();
    const sec = getSection(page.id, secId);
    if (!sec) return;
    const next = !sec.confirmed;
    pushHistory(page.id, sec.id, {
      name: sec.name, html: sec.html, note: sec.note,
      reason: next ? '컨펌 완료 체크' : '컨펌 해제',
      kind: next ? 'confirm' : 'unconfirm',
      savedAt: nowIso(),
    });
    sec.confirmed = next;
    sec.confirmedAt = next ? nowIso() : null;
    saveState();
    renderSections();
    toast(next ? '컨펌 완료로 표시됨' : '컨펌 해제됨', next ? 'success' : 'info');
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
      const kindLabel = v.kind === 'confirm' ? '✓ 컨펌' : v.kind === 'unconfirm' ? '↺ 컨펌해제' : v.kind === 'restore' ? '⟲ 복원' : '✎ 편집';
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
  function wrapPreview(bodyHtml) {
    return [
      '<!doctype html><html lang="ko"><head><meta charset="UTF-8"/>',
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
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
    toast('JSON 내보내기 완료', 'success');
  }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.pages)) throw new Error('형식 오류');
        if (!confirm('현재 빌더 데이터를 가져온 파일로 덮어쓸까요?')) return;
        state = Object.assign({ history: {}, activePageId: obj.pages[0].id }, obj);
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
      if (e.key === 'Escape') document.querySelectorAll('.modal-mask.open').forEach(m => m.classList.remove('open'));
    });

    window.addEventListener('online', () => {
      setSync('syncing', '재연결 중...');
      pushToFirestore();
    });
    window.addEventListener('offline', () => setSync('offline', '오프라인 — 연결되면 자동 동기화'));

    renderAll();
    initFirebase();
  });
})();
