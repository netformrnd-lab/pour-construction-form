(function () {
  'use strict';

  const STORAGE_KEY = 'pourstore-renewal-builder-v2';
  const STORAGE_KEY_V1 = 'pourstore-renewal-builder-v1';
  const HISTORY_LIMIT = 50;

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
        if (parsed && Array.isArray(parsed.pages)) return migrate(parsed);
      }
      // v1 → v2 자동 이관
      const v1raw = localStorage.getItem(STORAGE_KEY_V1);
      if (v1raw) {
        const v1 = JSON.parse(v1raw);
        if (v1 && Array.isArray(v1.pages)) {
          const migrated = migrate(v1);
          // 비어있는 페이지는 기본 시드 보충
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[builder] saveState 실패:', e);
      toast('저장 실패: ' + e.message, 'error');
    }
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
    if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
    state.history[k] = list;
  }

  // -------- rendering --------
  function renderAll() {
    renderPages();
    renderSections();
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
          <button class="btn btn-sm btn-ghost" data-act="preview">미리보기</button>
          <button class="btn btn-sm btn-outline" data-act="history">이력</button>
          <button class="btn btn-sm btn-primary" data-act="edit">편집</button>
          <button class="btn btn-sm btn-danger" data-act="delete" title="삭제">×</button>
        </div>
      `;
      card.querySelector('[data-act=confirm]').addEventListener('click', e => { e.stopPropagation(); toggleConfirm(s.id); });
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
            <button class="btn btn-sm btn-ghost" data-act="view">미리보기</button>
            <button class="btn btn-sm btn-primary" data-act="restore">복원</button>
          </div>
        </div>
        <div class="reason-row">
          <span class="reason-label">변경 사유</span>
          <div class="reason-text ${v.reason ? '' : 'empty'}" data-act="edit-reason" title="클릭하여 수정">${v.reason ? escapeHtml(v.reason) : '(사유 없음 — 클릭하여 추가)'}</div>
        </div>
      `;
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
  function previewHtml(html, title) {
    const w = window.open('', '_blank');
    if (!w) { toast('팝업이 차단되었습니다.', 'error'); return; }
    w.document.open();
    w.document.write(wrapPreview(html));
    w.document.close();
    if (title) try { w.document.title = title; } catch (_) {}
  }
  function previewFullPage() {
    const page = getActivePage();
    const body = page.sections.map((s, i) =>
      `<!-- [${i+1}] ${escapeHtml(s.name)} -->\n<section data-section="${escapeHtml(s.name)}" style="display:block;">\n${s.html || ''}\n</section>`
    ).join('\n\n');
    const w = window.open('', '_blank');
    if (!w) { toast('팝업이 차단되었습니다.', 'error'); return; }
    w.document.open();
    w.document.write(wrapPreview(body));
    w.document.close();
    try { w.document.title = `${page.name} 시안`; } catch (_) {}
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
    document.getElementById('btnOpenLive').addEventListener('click', () => {
      const page = getActivePage();
      window.open('./' + page.file, '_blank');
    });
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

    document.querySelectorAll('.modal-mask').forEach(mask => {
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-mask.open').forEach(m => m.classList.remove('open'));
    });

    renderAll();
  });
})();
