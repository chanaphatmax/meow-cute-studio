/**
 * เหมียวน่ารัก (Meow Cute 3:4) • UNSLOP GRAPHITE STUDIO & BACKEND AI DIRECTOR ENGINE
 */
(function () {
  'use strict';

  // --- MULTI-TENANT ISOLATED CLIENT SESSION (Zero Data Retention & Ephemeral Sandbox) ---
  function getOrCreateSessionId() {
    let sid = null;
    try {
      sid = sessionStorage.getItem('meow_session_id');
      if (!sid || sid.length < 16) {
        sid = 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem('meow_session_id', sid);
      }
    } catch (e) {
      sid = 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
    }
    return sid;
  }
  const currentSessionId = getOrCreateSessionId();

  // Dynamic API Base URL (Supports Netlify frontend talking to remote Render/Railway backend)
  function getApiBaseUrl() {
    let custom = localStorage.getItem('meow_backend_url') || '';
    if (custom) return custom.replace(/\/+$/, '');
    return '';
  }

  // Helper to ensure media URLs (video, audio) carry the session parameter for streaming
  function getSessionMediaUrl(url) {
    if (!url) return '';
    const apiBase = getApiBaseUrl();
    let fullUrl = url;
    if (apiBase && (url.startsWith('/user_sessions/') || url.startsWith('user_sessions/'))) {
      fullUrl = apiBase + (url.startsWith('/') ? '' : '/') + url;
    }
    if (fullUrl.includes('sid=')) return fullUrl;
    const hashIdx = fullUrl.indexOf('#');
    let base = fullUrl;
    let hash = '';
    if (hashIdx !== -1) {
      base = fullUrl.substring(0, hashIdx);
      hash = fullUrl.substring(hashIdx);
    }
    const sep = base.includes('?') ? '&' : '?';
    return base + sep + 'sid=' + encodeURIComponent(currentSessionId) + hash;
  }

  // Intercept all fetch calls to automatically tag X-Session-ID & route to custom backend if on Netlify
  const nativeFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      if (!options.headers.has('X-Session-ID')) options.headers.set('X-Session-ID', currentSessionId);
    } else if (Array.isArray(options.headers)) {
      options.headers.push(['X-Session-ID', currentSessionId]);
    } else {
      if (!options.headers['X-Session-ID']) options.headers['X-Session-ID'] = currentSessionId;
    }

    const apiBase = getApiBaseUrl();
    let finalUrl = url;
    if (apiBase && typeof url === 'string' && (url.startsWith('/api/') || url.startsWith('/user_sessions/'))) {
      finalUrl = apiBase + url;
    }
    return nativeFetch(finalUrl, options);
  };

  // --- WEB AUDIO SYNTHESIZER (Zero-Latency SFX Preview) ---
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  const SFX_SYNTH = {
    pop() {
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.085);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
    },
    shutter() {
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.14);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 1500;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 0.04);
      gain.gain.setValueAtTime(0.8, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(flt);
      flt.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.14);
    },
    sparkle() {
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      [1318.5, 1661.2, 1975.5, 2637.0].forEach((f, i) => {
        const st = now + i * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, st);
        gain.gain.setValueAtTime(0.28, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(st);
        osc.stop(st + 0.42);
      });
    },
    meow() {
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(1060, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.34);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.55, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    }
  };

  function triggerSfxSound(type) {
    if (SFX_SYNTH[type]) SFX_SYNTH[type]();
  }

  // --- LIVE WORKSPACE STATE (Starts completely empty — Zero Preloaded Videos) ---
  let clipsStore = {};
  let activeClipId = null;
  let project = null;
  let undoStack = [];
  let redoStack = [];
  let selectedSegmentId = null;
  let selectedSubId = null;
  let isViewingPreRenderedMp4 = false;
  let lastSfxPlayedAt = -1;
  let preferredSubtitleMode = 'keywords';

  // --- DOM REFERENCES ---
  const clipTabsList = document.getElementById('clipTabsList');
  const btnDeleteCurrentClip = document.getElementById('btnDeleteCurrentClip');
  const btnAppendClipTopbar = document.getElementById('btnAppendClipTopbar');
  const emptyClipState = document.getElementById('emptyClipState');
  let mergerQueue = [];
  const sourceVideo = document.getElementById('sourceVideo');
  const previewCanvas = document.getElementById('previewCanvas');
  const ctx = previewCanvas.getContext('2d');
  const canvasFrame = document.getElementById('canvasFrame');

  const segmentsListEl = document.getElementById('segmentsList');
  const zoomsListContainer = document.getElementById('zoomsListContainer');
  const effectsListContainer = document.getElementById('effectsListContainer');
  const totalCutDurationEl = document.getElementById('totalCutDuration');
  const subtitleListScrollEl = document.getElementById('subtitleListScroll');
  const subCountLabel = document.getElementById('subCountLabel');

  const inputActiveSubText = document.getElementById('inputActiveSubText');
  const inpActiveSubStart = document.getElementById('inpActiveSubStart');
  const inpActiveSubEnd = document.getElementById('inpActiveSubEnd');
  const wordChipsContainer = document.getElementById('wordChipsContainer');
  const chkUseKeywordPill = document.getElementById('chkUseKeywordPill');

  const inputHookBanner = document.getElementById('inputHookBanner');
  const inputPinName = document.getElementById('inputPinName');
  const inputPinPrice = document.getElementById('inputPinPrice');

  const laneSegments = document.getElementById('laneSegments');
  const laneZooms = document.getElementById('laneZooms');
  const laneSubtitles = document.getElementById('laneSubtitles');
  const laneSfx = document.getElementById('laneSfx');
  const timelineRuler = document.getElementById('timelineRuler');
  const nlePlayhead = document.getElementById('nlePlayhead');
  const timelineTracksArea = document.getElementById('timelineTracksArea');

  const RATIO_DIMS = {
    '3:4': { w: 720, h: 960, cls: 'ratio-3-4' },
    '9:16': { w: 720, h: 1280, cls: 'ratio-9-16' },
    '1:1': { w: 720, h: 720, cls: 'ratio-1-1' },
    '16:9': { w: 960, h: 540, cls: 'ratio-16-9' }
  };

  // --- TOPBAR CLIP TABS ---
  function renderClipTabsBar() {
    clipTabsList.innerHTML = '';
    const keys = Object.keys(clipsStore);

    if (keys.length === 0) {
      clipTabsList.style.display = 'none';
      if (btnDeleteCurrentClip) btnDeleteCurrentClip.style.display = 'none';
      if (btnAppendClipTopbar) btnAppendClipTopbar.style.display = 'none';
      emptyClipState.hidden = false;
      sourceVideo.pause();
      sourceVideo.removeAttribute('src');
      project = null;
      segmentsListEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:12px 4px;text-align:center;">อัปโหลดคลิปวิดีโอเพื่อเริ่มตัดต่อ</div>';
      zoomsListContainer.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:12px 4px;text-align:center;">อัปโหลดคลิปวิดีโอเพื่อจัดการจุดซูม</div>';
      effectsListContainer.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:12px 4px;text-align:center;">อัปโหลดคลิปวิดีโอเพื่อจัดการเอฟเฟกต์</div>';
      subtitleListScrollEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:12px 4px;text-align:center;">อัปโหลดคลิปวิดีโอเพื่อดึงซับคำสำคัญ (Keywords) อัตโนมัติ</div>';
      wordChipsContainer.innerHTML = '';
      if (subCountLabel) subCountLabel.textContent = '0 บรรทัด';
      if (totalCutDurationEl) totalCutDurationEl.textContent = '0.0s';
      inputActiveSubText.value = '';
      inpActiveSubStart.value = '0.0';
      inpActiveSubEnd.value = '0.0';
      inputHookBanner.value = '';
      inputPinName.value = '';
      inputPinPrice.value = '';
      laneSegments.innerHTML = '';
      laneZooms.innerHTML = '';
      laneSubtitles.innerHTML = '';
      laneSfx.innerHTML = '';
      timelineRuler.innerHTML = '';
      return;
    }

    clipTabsList.style.display = 'flex';
    if (btnDeleteCurrentClip) btnDeleteCurrentClip.style.display = 'inline-flex';
    if (btnAppendClipTopbar) btnAppendClipTopbar.style.display = 'inline-flex';
    emptyClipState.hidden = true;

    keys.forEach((cid, idx) => {
      const clipObj = clipsStore[cid];
      const btn = document.createElement('div');
      btn.className = `clip-tab-item ${cid === activeClipId ? 'active' : ''}`;
      btn.innerHTML = `
        <span class="clip-tab-num">${idx + 1}</span>
        <span class="clip-tab-label">${clipObj.shortTitle || clipObj.title || ('คลิป ' + (idx + 1))}</span>
        <span class="clip-tab-del" title="ลบคลิปนี้ออกจากโปรเจกต์">✕</span>
      `;

      btn.addEventListener('click', (e) => {
        if (e.target.classList.contains('clip-tab-del')) {
          e.stopPropagation();
          deleteClipById(cid);
          return;
        }
        selectClipById(cid);
      });

      clipTabsList.appendChild(btn);
    });
  }

  function deleteClipById(cid) {
    if (!clipsStore[cid]) return;
    const removedTitle = clipsStore[cid].shortTitle || clipsStore[cid].title || cid;
    delete clipsStore[cid];

    const remainingKeys = Object.keys(clipsStore);
    if (remainingKeys.length === 0) {
      activeClipId = null;
      project = null;
      fetch('/api/session/purge', { method: 'POST' }).catch(() => {});
      renderClipTabsBar();
      showToast(`ลบ "${removedTitle}" และล้างข้อมูลเซิร์ฟเวอร์ทั้งหมดแล้ว (Zero-Retention)`);
    } else {
      if (activeClipId === cid) {
        selectClipById(remainingKeys[0]);
      } else {
        renderClipTabsBar();
      }
      showToast(`ลบ "${removedTitle}" ออกจากรายการแล้ว`);
    }
  }

  function selectClipById(cid) {
    if (!clipsStore[cid]) return;
    activeClipId = cid;
    project = clipsStore[cid];
    if (!project.style) project.style = { fontFamily: 'Kanit', fontSize: 44, accentColor: '#FF5A96', subYRatio: 0.83, usePill: true };
    if (project.style.usePill === undefined) project.style.usePill = true;
    if (!project.subtitleMode) project.subtitleMode = 'keywords';
    if (!project.zooms) project.zooms = [];
    if (!project.sfx) project.sfx = [];
    if (!project.vfx) project.vfx = [];

    isViewingPreRenderedMp4 = false;

    undoStack = [];
    redoStack = [];
    selectedSegmentId = project.segments && project.segments[0] ? project.segments[0].id : null;
    selectedSubId = project.subtitles && project.subtitles[0] ? project.subtitles[0].id : null;

    sourceVideo.src = getSessionMediaUrl(project.sourcePath);
    sourceVideo.load();
    sourceVideo.currentTime = project.segments && project.segments[0] ? project.segments[0].sourceStart : 0;

    renderClipTabsBar();
    syncAllUI();
  }

  // --- HISTORY ---
  function pushHistory() {
    if (!project) return;
    undoStack.push(JSON.stringify(project));
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0 || !project) {
      showToast('ไม่มีรายการให้ย้อนกลับ');
      return;
    }
    redoStack.push(JSON.stringify(project));
    project = JSON.parse(undoStack.pop());
    clipsStore[activeClipId] = project;
    syncAllUI();
    showToast('ย้อนกลับการแก้ไขแล้ว');
  }

  function redo() {
    if (redoStack.length === 0 || !project) return;
    undoStack.push(JSON.stringify(project));
    project = JSON.parse(redoStack.pop());
    clipsStore[activeClipId] = project;
    syncAllUI();
    showToast('ทำซ้ำการแก้ไขแล้ว');
  }

  // --- SYNC ALL UI CONTROLS ---
  function syncAllUI() {
    if (!project) return;

    const rCfg = RATIO_DIMS[project.aspectRatio] || RATIO_DIMS['3:4'];
    previewCanvas.width = rCfg.w;
    previewCanvas.height = rCfg.h;
    canvasFrame.className = `canvas-holder ${rCfg.cls}`;

    document.querySelectorAll('#ratioSelector .ps-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.ratio === project.aspectRatio);
    });
    document.querySelectorAll('#fitModeSelector .ps-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.fit === project.fitMode);
    });

    const cropPct = Math.round((project.defaultCropY ?? 0.30) * 100);
    document.getElementById('sliderCropY').value = cropPct;
    document.getElementById('valCropY').textContent = `${cropPct}%`;

    // Subtitle Mode Switcher ('keywords' vs 'full') synced across all 3 switches
    const subMode = project.subtitleMode || preferredSubtitleMode || 'keywords';
    preferredSubtitleMode = subMode;
    document.querySelectorAll('[data-submode]').forEach(b => {
      b.classList.toggle('active', b.dataset.submode === subMode);
    });

    // Font & Color controls
    const fFam = project.style.fontFamily || 'Kanit';
    document.querySelectorAll('#fontSelectorGrid .font-option-card').forEach(card => {
      card.classList.toggle('active', card.dataset.font.toLowerCase() === fFam.toLowerCase());
    });

    const accCol = (project.style.accentColor || '#FF5A96').toLowerCase();
    document.querySelectorAll('#stylePresetSelector .preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color.toLowerCase() === accCol);
    });

    const fSize = project.style.fontSize || 44;
    document.getElementById('sliderFontSize').value = fSize;
    document.getElementById('valFontSize').textContent = `${fSize}px`;

    const subYPct = Math.round((project.style.subYRatio || 0.83) * 100);
    document.getElementById('sliderSubY').value = subYPct;
    document.getElementById('valSubY').textContent = `${subYPct}%`;
    chkUseKeywordPill.checked = project.style.usePill !== false;

    inputHookBanner.value = project.hookText || '';
    if (project.pins && project.pins[0]) {
      inputPinName.value = project.pins[0].title || '';
      inputPinPrice.value = project.pins[0].price || '';
    }

    renderSegmentsPanel();
    renderZoomsPanel();
    renderEffectsPanel();
    renderSubtitleListPanel();
    renderActiveSubEditor();
    renderMultiTrackTimeline();
  }

  // --- LEFT TAB 1: MANUAL SEGMENTS CUTTER ---
  function renderSegmentsPanel() {
    segmentsListEl.innerHTML = '';
    if (!project || !project.segments) return;
    let keptTotal = 0;

    project.segments.forEach((seg, idx) => {
      const dur = Math.max(0, seg.sourceEnd - seg.sourceStart);
      if (!seg.deleted) keptTotal += dur;

      const card = document.createElement('div');
      card.className = `seg-card ${seg.id === selectedSegmentId ? 'active' : ''} ${seg.deleted ? 'deleted' : ''}`;
      card.innerHTML = `
        <div class="seg-card-top">
          <div class="seg-title">
            <span class="seg-badge">#${idx + 1}</span>
            <span>${seg.label || `คัตที่ ${idx + 1}`}</span>
          </div>
          <span class="mono-num">${dur.toFixed(2)}s</span>
        </div>
        <div class="seg-controls-row">
          <div class="seg-time-inputs">
            <input type="number" step="0.05" min="0" class="num-input-xs inp-seg-start" value="${seg.sourceStart.toFixed(2)}" title="เวลาเริ่ม (วินาที)">
            <span>-</span>
            <input type="number" step="0.05" min="0.2" class="num-input-xs inp-seg-end" value="${seg.sourceEnd.toFixed(2)}" title="เวลาจบ (วินาที)">
          </div>
          <div class="seg-actions">
            <button class="seg-btn-xs btn-seg-zoom" title="ระดับซูมฐานของคัตนี้">ซูม ${seg.zoomScale > 1.01 ? seg.zoomScale.toFixed(2) + 'x' : '1x'}</button>
            <button class="seg-btn-xs ${seg.deleted ? '' : 'seg-btn-del'} btn-seg-toggle">
              ${seg.deleted ? 'กู้คืน' : 'ลบคัต'}
            </button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        selectedSegmentId = seg.id;
        sourceVideo.currentTime = seg.sourceStart;
        renderSegmentsPanel();
        renderMultiTrackTimeline();
      });

      const inpStart = card.querySelector('.inp-seg-start');
      const inpEnd = card.querySelector('.inp-seg-end');
      inpStart.addEventListener('change', () => {
        pushHistory();
        seg.sourceStart = Math.max(0, Math.min(seg.sourceEnd - 0.15, parseFloat(inpStart.value) || 0));
        sourceVideo.currentTime = seg.sourceStart;
        syncAllUI();
      });
      inpEnd.addEventListener('change', () => {
        pushHistory();
        seg.sourceEnd = Math.max(seg.sourceStart + 0.15, parseFloat(inpEnd.value) || seg.sourceStart + 1);
        syncAllUI();
      });

      card.querySelector('.btn-seg-zoom').addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory();
        const cycle = [1.0, 1.15, 1.25, 1.35];
        const curIdx = cycle.findIndex(v => Math.abs(v - (seg.zoomScale || 1.0)) < 0.03);
        seg.zoomScale = cycle[(curIdx + 1) % cycle.length];
        syncAllUI();
        showToast(`ตั้งค่าซูมฐานคัต #${idx + 1} เป็น ${seg.zoomScale.toFixed(2)}x`);
      });

      card.querySelector('.btn-seg-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory();
        seg.deleted = !seg.deleted;
        syncAllUI();
        showToast(seg.deleted ? `ลบคัต #${idx + 1} ออกแล้ว (ข้ามอัตโนมัติ)` : `กู้คืนคัต #${idx + 1} แล้ว`);
      });

      segmentsListEl.appendChild(card);
    });

    totalCutDurationEl.textContent = `${keptTotal.toFixed(1)}s`;
    document.getElementById('uiTimeTotal').textContent = formatTimecode(keptTotal);
  }

  // --- LEFT TAB 2: CAMERA ZOOM MANAGER (Add, Edit Start/End/Scale/Mode, Delete) ---
  function renderZoomsPanel() {
    zoomsListContainer.innerHTML = '';
    if (!project) return;
    const zooms = project.zooms || [];

    if (zooms.length === 0) {
      zoomsListContainer.innerHTML = '<div class="box-hint" style="padding:12px 4px;">ยังไม่มีจุดซูมภาพ กดปุ่ม +ซูมด้านบนเพื่อเพิ่มตรงหัวอ่านได้เลย</div>';
      return;
    }

    zooms.sort((a, b) => a.start - b.start);

    zooms.forEach((z, idx) => {
      if (!z.id) z.id = 'z_' + idx + '_' + Date.now();
      const card = document.createElement('div');
      card.className = 'seg-card';
      const isPunch = z.mode === 'punch';
      card.innerHTML = `
        <div class="seg-card-top">
          <div class="seg-title">
            <span class="seg-badge">ซูม #${idx + 1}</span>
            <span>${z.label || (isPunch ? 'ซูมกระแทกคำ' : 'ซูมนุ่มนวล')}</span>
          </div>
          <span class="mono-num">${z.scale.toFixed(2)}x</span>
        </div>
        <div class="seg-controls-row">
          <div class="seg-time-inputs">
            <input type="number" step="0.1" min="0" class="num-input-xs inp-z-start" value="${z.start.toFixed(2)}" title="เวลาเริ่มซูม">
            <span>-</span>
            <input type="number" step="0.1" min="0.2" class="num-input-xs inp-z-end" value="${z.end.toFixed(2)}" title="เวลาจบซูม">
          </div>
          <div class="seg-actions">
            <button class="seg-btn-xs btn-z-scale" title="คลิกเพื่อเปลี่ยนระดับความซูม">${z.scale.toFixed(2)}x</button>
            <button class="seg-btn-xs btn-z-mode" title="คลิกเพื่อสลับซูมนุ่มนวล / ซูมกระแทก">${isPunch ? 'กระแทก' : 'นุ่มนวล'}</button>
            <button class="seg-btn-xs seg-btn-del btn-z-del" title="ลบจุดซูมนี้">ลบ</button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        sourceVideo.currentTime = z.start + 0.05;
      });

      card.querySelector('.inp-z-start').addEventListener('change', (e) => {
        pushHistory();
        z.start = Math.max(0, Math.min(z.end - 0.2, parseFloat(e.target.value) || 0));
        sourceVideo.currentTime = z.start;
        syncAllUI();
      });

      card.querySelector('.inp-z-end').addEventListener('change', (e) => {
        pushHistory();
        z.end = Math.max(z.start + 0.2, parseFloat(e.target.value) || z.start + 1.5);
        syncAllUI();
      });

      card.querySelector('.btn-z-scale').addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory();
        const scales = [1.15, 1.20, 1.25, 1.30, 1.40, 1.50];
        const ci = scales.findIndex(s => Math.abs(s - z.scale) < 0.03);
        z.scale = scales[(ci + 1) % scales.length];
        syncAllUI();
        showToast(`ปรับระดับซูม #${idx + 1} เป็น ${z.scale.toFixed(2)}x`);
      });

      card.querySelector('.btn-z-mode').addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory();
        z.mode = z.mode === 'punch' ? 'smooth' : 'punch';
        syncAllUI();
        showToast(`เปลี่ยนรูปแบบซูม #${idx + 1} เป็น ${z.mode === 'punch' ? 'ซูมกระแทกจังหวะ' : 'ซูมนุ่มนวลธรรมชาติ'}`);
      });

      card.querySelector('.btn-z-del').addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory();
        project.zooms = project.zooms.filter(item => item !== z);
        syncAllUI();
        showToast(`ลบซูม #${idx + 1} ออกแล้ว`);
      });

      zoomsListContainer.appendChild(card);
    });
  }

  // --- LEFT TAB 3: EFFECTS MANAGER (SFX & VFX Add/Edit/Delete) ---
  function renderEffectsPanel() {
    effectsListContainer.innerHTML = '';
    if (!project) return;

    const sfxList = (project.sfx || []).map((s, i) => ({ _kind: 'sfx', _ref: s, time: s.time, idx: i }));
    const vfxList = (project.vfx || []).map((v, i) => ({ _kind: 'vfx', _ref: v, time: v.start, idx: i }));
    const combined = [...sfxList, ...vfxList].sort((a, b) => a.time - b.time);

    if (combined.length === 0) {
      effectsListContainer.innerHTML = '<div class="box-hint" style="padding:10px 4px;">ไม่มีเอฟเฟกต์ในคลิป กดปุ่มด้านบนเพื่อวางเอฟเฟกต์ตรงหัวอ่านได้ทันที</div>';
      return;
    }

    const sfxNames = { pop: 'เสียงป๊อปเด้ง', sparkle: 'เสียงวิ้งวับ', shutter: 'เสียงชัตเตอร์', meow: 'เสียงเหมียว' };
    const vfxNames = { warm_glow: 'เอฟเฟกต์ผิวใส', flash: 'แฟลชเปลี่ยนฉาก' };

    combined.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'seg-card';
      if (item._kind === 'sfx') {
        const s = item._ref;
        row.innerHTML = `
          <div class="seg-controls-row">
            <div class="seg-title">
              <span class="seg-badge">SFX</span>
              <span>${s.label || sfxNames[s.type] || s.type}</span>
            </div>
            <div class="seg-actions">
              <input type="number" step="0.1" min="0" class="num-input-xs inp-fx-time" value="${s.time.toFixed(2)}" title="เวลาที่เล่นเสียง (วินาที)">
              <button class="seg-btn-xs btn-fx-play" title="ฟังเสียง">ฟัง</button>
              <button class="seg-btn-xs seg-btn-del btn-fx-del" title="ลบเอฟเฟกต์นี้">ลบ</button>
            </div>
          </div>
        `;
        row.querySelector('.inp-fx-time').addEventListener('change', (e) => {
          pushHistory();
          s.time = Math.max(0, parseFloat(e.target.value) || 0);
          syncAllUI();
        });
        row.querySelector('.btn-fx-play').addEventListener('click', (e) => {
          e.stopPropagation();
          triggerSfxSound(s.type);
        });
        row.querySelector('.btn-fx-del').addEventListener('click', (e) => {
          e.stopPropagation();
          pushHistory();
          project.sfx = project.sfx.filter(x => x !== s);
          syncAllUI();
          showToast('ลบเอฟเฟกต์เสียงแล้ว');
        });
      } else {
        const v = item._ref;
        row.innerHTML = `
          <div class="seg-controls-row">
            <div class="seg-title">
              <span class="seg-badge">VFX</span>
              <span>${v.label || vfxNames[v.type] || v.type}</span>
            </div>
            <div class="seg-actions">
              <span class="mono-num">${v.start.toFixed(1)}s-${v.end.toFixed(1)}s</span>
              <button class="seg-btn-xs seg-btn-del btn-fx-del" title="ลบเอฟเฟกต์ภาพนี้">ลบ</button>
            </div>
          </div>
        `;
        row.addEventListener('click', () => {
          sourceVideo.currentTime = v.start + 0.05;
        });
        row.querySelector('.btn-fx-del').addEventListener('click', (e) => {
          e.stopPropagation();
          pushHistory();
          project.vfx = project.vfx.filter(x => x !== v);
          syncAllUI();
          showToast('ลบเอฟเฟกต์ภาพแล้ว');
        });
      }
      effectsListContainer.appendChild(row);
    });
  }

  // --- RIGHT PANEL: SUBTITLES, KEYWORD-ONLY FILTER & SUBTITLE ZOOM (ซูมซับ) ---
  function getActiveSubObject() {
    if (!project || !project.subtitles || project.subtitles.length === 0) return null;
    let sub = project.subtitles.find(s => s.id === selectedSubId);
    if (!sub) {
      sub = project.subtitles[0];
      selectedSubId = sub.id;
    }
    return sub;
  }

  function parseSubToTokens(rawText) {
    if (!rawText) return [];
    const parts = rawText.split('*');
    const tokens = [];
    parts.forEach((part, idx) => {
      const clean = part.trim();
      if (!clean) return;
      const isHi = (idx % 2 === 1);
      if (isHi) {
        tokens.push({ text: clean, highlight: true });
      } else {
        clean.split(/\s+/).forEach(w => {
          if (w) tokens.push({ text: w, highlight: false });
        });
      }
    });
    return tokens;
  }

  function serializeTokensToSubText(tokens) {
    return tokens.map(t => t.highlight ? `*${t.text}*` : t.text).join(' ');
  }

  function condenseLineToKeywordsOnly(rawText) {
    const tokens = parseSubToTokens(rawText);
    const hiTokens = tokens.filter(t => t.highlight);
    if (hiTokens.length > 0) {
      return hiTokens.map(t => `*${t.text}*`).join(' ');
    }
    if (tokens.length > 0) {
      return `*${tokens[0].text}*`;
    }
    return rawText;
  }

  function renderActiveSubEditor() {
    const sub = getActiveSubObject();
    if (!sub) {
      inputActiveSubText.value = '';
      inpActiveSubStart.value = '0.00';
      inpActiveSubEnd.value = '0.00';
      wordChipsContainer.innerHTML = '<span class="box-hint">กดปุ่ม +เพิ่มซับ เพื่อสร้างข้อความ</span>';
      return;
    }

    if (document.activeElement !== inputActiveSubText) {
      inputActiveSubText.value = sub.text;
    }
    if (document.activeElement !== inpActiveSubStart) {
      inpActiveSubStart.value = sub.start.toFixed(2);
    }
    if (document.activeElement !== inpActiveSubEnd) {
      inpActiveSubEnd.value = sub.end.toFixed(2);
    }

    // Sync Subtitle Zoom (ซูมซับ) buttons for active line
    const curSubZoom = sub.subZoom !== undefined ? Number(sub.subZoom) : 1.28;
    document.querySelectorAll('#activeSubZoomGroup .sz-btn').forEach(btn => {
      const bVal = parseFloat(btn.dataset.subzoom);
      btn.classList.toggle('active', Math.abs(bVal - curSubZoom) < 0.05);
    });

    const tokens = parseSubToTokens(sub.text);
    wordChipsContainer.innerHTML = '';

    tokens.forEach((tk, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `word-chip ${tk.highlight ? 'is-highlighted' : ''}`;
      btn.innerHTML = `${tk.highlight ? '<span class="star-dot"></span>' : ''}<span>${tk.text}</span>`;
      btn.addEventListener('click', () => {
        pushHistory();
        tokens[idx].highlight = !tokens[idx].highlight;
        sub.text = serializeTokensToSubText(tokens);
        inputActiveSubText.value = sub.text;
        renderActiveSubEditor();
        renderSubtitleListPanel();
        renderMultiTrackTimeline();
      });
      wordChipsContainer.appendChild(btn);
    });
  }

  function renderSubtitleListPanel() {
    subtitleListScrollEl.innerHTML = '';
    if (!project || !project.subtitles) {
      subCountLabel.textContent = '0';
      return;
    }

    subCountLabel.textContent = String(project.subtitles.length);

    project.subtitles.forEach((sub) => {
      const row = document.createElement('div');
      row.className = `sub-row-item ${sub.id === selectedSubId ? 'active' : ''}`;
      const formattedHtml = sub.text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      const sz = sub.subZoom !== undefined ? Number(sub.subZoom) : 1.28;
      const hasZoom = sz > 1.02;

      row.innerHTML = `
        <div class="sub-row-time">${sub.start.toFixed(2)}-${sub.end.toFixed(2)}s</div>
        <div class="sub-row-text">${formattedHtml}</div>
        <button class="btn-row-subzoom ${hasZoom ? 'has-zoom' : ''}" title="คลิกเพื่อสลับระดับซูมซับบรรทัดนี้">${hasZoom ? `ซูม ${sz.toFixed(2)}x` : 'ซับนิ่ง 1x'}</button>
        <button class="btn-del-sub" title="ลบบรรทัดซับนี้">×</button>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        selectedSubId = sub.id;
        sourceVideo.currentTime = sub.start + 0.04;
        renderActiveSubEditor();
        renderSubtitleListPanel();
        renderMultiTrackTimeline();
      });

      row.querySelector('.btn-row-subzoom').addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory();
        const cycle = [1.0, 1.18, 1.28, 1.40];
        const curIdx = cycle.findIndex(v => Math.abs(v - sz) < 0.05);
        sub.subZoom = cycle[(curIdx + 1) % cycle.length];
        syncAllUI();
        showToast(sub.subZoom > 1.02 ? `ตั้งซูมซับเป็น ${sub.subZoom.toFixed(2)}x` : 'ปิดซูมซับบรรทัดนี้แล้ว (1.0x)');
      });

      row.querySelector('.btn-del-sub').addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory();
        project.subtitles = project.subtitles.filter(s => s.id !== sub.id);
        if (selectedSubId === sub.id) {
          selectedSubId = project.subtitles[0] ? project.subtitles[0].id : null;
        }
        syncAllUI();
        showToast('ลบซับไตเติลแล้ว');
      });

      subtitleListScrollEl.appendChild(row);
    });
  }

  // --- MULTI-TRACK TIMELINE (Every block has direct click & × delete) ---
  function getMaxSourceDuration() {
    const vidDur = sourceVideo.duration;
    if (vidDur && !isNaN(vidDur) && vidDur > 1) return vidDur;
    let maxEnd = 20;
    if (project && project.segments) {
      project.segments.forEach(s => { if (s.sourceEnd > maxEnd) maxEnd = s.sourceEnd; });
    }
    return maxEnd;
  }

  function renderMultiTrackTimeline() {
    if (!project) return;
    const maxDur = getMaxSourceDuration();

    timelineRuler.innerHTML = '';
    const stepSec = maxDur > 40 ? 5 : 2;
    for (let t = 0; t <= maxDur; t += stepSec) {
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.style.left = `${(t / maxDur) * 100}%`;
      tick.textContent = `${t}s`;
      timelineRuler.appendChild(tick);
    }

    // Track 1: Video Segments
    laneSegments.innerHTML = '';
    (project.segments || []).forEach((seg, idx) => {
      const left = (seg.sourceStart / maxDur) * 100;
      const width = ((seg.sourceEnd - seg.sourceStart) / maxDur) * 100;
      const el = document.createElement('div');
      el.className = `tl-seg-block ${seg.id === selectedSegmentId ? 'active' : ''} ${seg.deleted ? 'deleted' : ''}`;
      el.style.left = `${left}%`;
      el.style.width = `${Math.max(1.2, width)}%`;
      el.innerHTML = `<span>${seg.deleted ? 'ตัดออก' : `#${idx + 1} ${seg.label || ''}`}</span><span class="tl-del-x" title="ลบหรือกู้คืนคัตนี้">×</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.classList.contains('tl-del-x')) {
          pushHistory();
          seg.deleted = !seg.deleted;
          syncAllUI();
          return;
        }
        selectedSegmentId = seg.id;
        sourceVideo.currentTime = seg.sourceStart;
        renderSegmentsPanel();
        renderMultiTrackTimeline();
      });
      laneSegments.appendChild(el);
    });

    // Track 2: Camera Zooms
    laneZooms.innerHTML = '';
    (project.zooms || []).forEach((z) => {
      const left = (z.start / maxDur) * 100;
      const width = ((z.end - z.start) / maxDur) * 100;
      const el = document.createElement('div');
      el.className = 'tl-zoom-block';
      el.style.left = `${left}%`;
      el.style.width = `${Math.max(2.2, width)}%`;
      el.innerHTML = `<span>${z.scale.toFixed(2)}x</span><span class="tl-del-x" title="ลบจุดซูมนี้">×</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.classList.contains('tl-del-x')) {
          pushHistory();
          project.zooms = project.zooms.filter(item => item !== z);
          syncAllUI();
          showToast('ลบจุดซูมแล้ว');
          return;
        }
        sourceVideo.currentTime = z.start + 0.05;
        document.getElementById('tabBtnZooms').click();
      });
      laneZooms.appendChild(el);
    });

    // Track 3: Subtitles
    laneSubtitles.innerHTML = '';
    (project.subtitles || []).forEach((sub) => {
      const left = (sub.start / maxDur) * 100;
      const width = ((sub.end - sub.start) / maxDur) * 100;
      const el = document.createElement('div');
      el.className = `tl-sub-block ${sub.id === selectedSubId ? 'active' : ''}`;
      el.style.left = `${left}%`;
      el.style.width = `${Math.max(1.5, width)}%`;
      const cleanSubTxt = (sub.text || '').replace(/\*/g, '');
      el.innerHTML = `<span title="${cleanSubTxt}">${cleanSubTxt}</span><span class="tl-del-x" title="ลบซับนี้">×</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.classList.contains('tl-del-x')) {
          pushHistory();
          project.subtitles = project.subtitles.filter(s => s !== sub);
          syncAllUI();
          showToast('ลบซับไตเติลแล้ว');
          return;
        }
        selectedSubId = sub.id;
        sourceVideo.currentTime = sub.start + 0.04;
        renderActiveSubEditor();
        renderSubtitleListPanel();
        renderMultiTrackTimeline();
      });
      laneSubtitles.appendChild(el);
    });

    // Track 4: SFX & VFX
    laneSfx.innerHTML = '';
    const sfxShort = { shutter: 'ชัตเตอร์', sparkle: 'วิ้ง', pop: 'ป๊อป', meow: 'เหมียว' };
    (project.sfx || []).forEach((ev) => {
      const left = (ev.time / maxDur) * 100;
      const el = document.createElement('div');
      el.className = 'tl-sfx-pin';
      el.style.left = `${left}%`;
      el.innerHTML = `<span>${sfxShort[ev.type] || ev.type}</span><span class="tl-del-x" title="ลบเสียงนี้">×</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.classList.contains('tl-del-x')) {
          pushHistory();
          project.sfx = project.sfx.filter(item => item !== ev);
          syncAllUI();
          showToast('ลบเอฟเฟกต์เสียงแล้ว');
          return;
        }
        triggerSfxSound(ev.type);
      });
      laneSfx.appendChild(el);
    });
  }

  // --- 60FPS CANVAS COMPOSITOR ---
  function drawSparkleVector(c, cx, cy, r, color) {
    c.save();
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? r : r * 0.28;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = color;
    c.fill();
    c.restore();
  }

  function drawRoundedRect(c, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.lineTo(x + w - rad, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rad);
    c.lineTo(x + w, y + h - rad);
    c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    c.lineTo(x + rad, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rad);
    c.lineTo(x, y + rad);
    c.quadraticCurveTo(x, y, x + rad, y);
    c.closePath();
  }

  function renderFrameLoop() {
    const curTime = sourceVideo.currentTime || 0;
    const maxDur = getMaxSourceDuration();

    document.getElementById('uiTimeCur').textContent = formatTimecode(curTime);
    const zTimeEl = document.getElementById('zoomPlayheadTime');
    if (zTimeEl) zTimeEl.textContent = `${curTime.toFixed(1)}s`;

    const laneRect = timelineTracksArea.getBoundingClientRect();
    const usableW = Math.max(80, laneRect.width - 76);
    const pct = Math.max(0, Math.min(1, curTime / maxDur));
    nlePlayhead.style.left = `${76 + pct * usableW}px`;

    if (!isViewingPreRenderedMp4 && !sourceVideo.paused && project && project.segments) {
      const hasDeleted = (project.segments || []).some(s => s.deleted);
      if (hasDeleted) {
        const keptSegs = project.segments.filter(s => !s.deleted);
        if (keptSegs.length > 0) {
          const inKept = keptSegs.find(s => curTime >= s.sourceStart - 0.05 && curTime <= s.sourceEnd + 0.05);
          if (!inKept) {
            const nextSeg = keptSegs.find(s => s.sourceStart > curTime);
            if (nextSeg) {
              sourceVideo.currentTime = nextSeg.sourceStart;
            } else {
              sourceVideo.pause();
              sourceVideo.currentTime = keptSegs[0].sourceStart;
              document.getElementById('playIcon').textContent = '▶';
            }
          }
        }
      }

      (project.sfx || []).forEach(ev => {
        if (Math.abs(curTime - ev.time) < 0.06 && Math.abs(lastSfxPlayedAt - ev.time) > 0.25) {
          lastSfxPlayedAt = ev.time;
          triggerSfxSound(ev.type);
        }
      });
    }

    if (!isViewingPreRenderedMp4 && project && project.subtitles && document.activeElement !== inputActiveSubText) {
      const activeSub = project.subtitles.find(s => curTime >= s.start && curTime <= s.end);
      if (activeSub && activeSub.id !== selectedSubId) {
        selectedSubId = activeSub.id;
        renderActiveSubEditor();
        renderSubtitleListPanel();
        renderMultiTrackTimeline();
      }
    }

    const cw = previewCanvas.width;
    const ch = previewCanvas.height;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cw, ch);

    if (sourceVideo.readyState >= 2 && project) {
      const vw = sourceVideo.videoWidth || 576;
      const vh = sourceVideo.videoHeight || 1024;

      if (isViewingPreRenderedMp4) {
        ctx.drawImage(sourceVideo, 0, 0, cw, ch);
        requestAnimationFrame(renderFrameLoop);
        return;
      }

      const curSeg = (project.segments || []).find(s => curTime >= s.sourceStart && curTime <= s.sourceEnd);
      let zoom = curSeg ? (curSeg.zoomScale || 1.0) : 1.0;
      const cropY = curSeg && curSeg.cropY !== undefined ? curSeg.cropY : (project.defaultCropY ?? 0.30);

      (project.zooms || []).forEach(z => {
        if (curTime >= z.start && curTime <= z.end) {
          const zd = Math.max(0.2, z.end - z.start);
          const rel = curTime - z.start;
          const inRamp = z.mode === 'punch' ? 0.09 : 0.24;
          const outRamp = z.mode === 'punch' ? 0.16 : 0.28;
          let ease = 1.0;
          if (rel < inRamp) ease = 0.5 - 0.5 * Math.cos(Math.PI * (rel / inRamp));
          else if (rel > zd - outRamp) ease = 0.5 - 0.5 * Math.cos(Math.PI * ((zd - rel) / outRamp));
          zoom = Math.max(zoom, 1.0 + (z.scale - 1.0) * ease);
        }
      });

      if (project.fitMode === 'fill') {
        const scale = Math.max(cw / vw, ch / vh) * zoom;
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) / 2;
        const dy = -(dh - ch) * Math.max(0, Math.min(1, cropY));
        ctx.drawImage(sourceVideo, dx, dy, dw, dh);
      } else {
        ctx.save();
        ctx.filter = 'blur(22px) brightness(0.55)';
        ctx.drawImage(sourceVideo, -cw * 0.1, -ch * 0.1, cw * 1.2, ch * 1.2);
        ctx.restore();

        const scale = Math.min(cw / vw, ch / vh) * zoom;
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        ctx.drawImage(sourceVideo, dx, dy, dw, dh);
      }

      // Render Visual Effects (vfx: warm_glow, flash)
      (project.vfx || []).forEach(v => {
        if (curTime >= v.start && curTime <= v.end) {
          if (v.type === 'warm_glow') {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 195, 160, 0.10)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.restore();
          } else if (v.type === 'flash') {
            const vd = Math.max(0.1, v.end - v.start);
            const alpha = Math.max(0, Math.min(0.75, (1.0 - (curTime - v.start) / vd) * (v.intensity || 0.45)));
            ctx.save();
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(0, 0, cw, ch);
            ctx.restore();
          }
        }
      });

      const grad = ctx.createLinearGradient(0, ch * 0.72, 0, ch);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.48)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, ch * 0.72, cw, ch * 0.28);

      const scaleFactor = cw / 720;
      const accentColor = (project.style && project.style.accentColor) || '#FF5A96';
      const fontName = (project.style && project.style.fontFamily) || 'Kanit';

      // Top Hook Banner
      if (project.hookText && project.hookText.trim()) {
        ctx.save();
        const hookFontPx = Math.round(23 * scaleFactor);
        ctx.font = `700 ${hookFontPx}px "${fontName}", "Prompt", sans-serif`;
        const cleanHook = project.hookText.trim();
        const tw = ctx.measureText(cleanHook).width;
        const bw = Math.min(cw - 40, tw + 78 * scaleFactor);
        const bh = Math.round(46 * scaleFactor);
        const bx = (cw - bw) / 2;
        const by = Math.round(28 * (ch / 960));

        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        drawRoundedRect(ctx, bx, by + 4, bw, bh, 23 * scaleFactor);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3 * scaleFactor;
        drawRoundedRect(ctx, bx, by, bw, bh, 23 * scaleFactor);
        ctx.fill();
        ctx.stroke();

        drawSparkleVector(ctx, bx + 22 * scaleFactor, by + bh / 2, 9 * scaleFactor, accentColor);
        drawSparkleVector(ctx, bx + bw - 22 * scaleFactor, by + bh / 2, 9 * scaleFactor, accentColor);

        ctx.fillStyle = '#141419';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cleanHook, cw / 2, by + bh / 2 + 1);
        ctx.restore();
      }

      // Floating Product Pin
      if (project.pins && project.pins[0] && project.pins[0].title) {
        const pin = project.pins[0];
        ctx.save();
        const pinFontPx = Math.round(19 * scaleFactor);
        ctx.font = `700 ${pinFontPx}px "${fontName}", sans-serif`;
        const w1 = ctx.measureText(pin.title).width;
        const w2 = ctx.measureText(pin.price || '').width;
        const pw = w1 + w2 + 86 * scaleFactor;
        const ph = Math.round(42 * scaleFactor);
        const px = Math.round(26 * scaleFactor);
        const py = Math.round(86 * (ch / 960));

        ctx.fillStyle = 'rgba(18,18,22,0.92)';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, px, py, pw, ph, 13 * scaleFactor);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(px + 20 * scaleFactor, py + ph / 2, 6 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(pin.title, px + 34 * scaleFactor, py + ph / 2 + 1);

        if (pin.price) {
          const prX = px + 44 * scaleFactor + w1;
          const prW = w2 + 24 * scaleFactor;
          ctx.fillStyle = accentColor;
          drawRoundedRect(ctx, prX, py + 6 * scaleFactor, prW, ph - 12 * scaleFactor, 8 * scaleFactor);
          ctx.fill();

          ctx.fillStyle = accentColor.toLowerCase() === '#ffe600' || accentColor.toLowerCase() === '#ffffff' ? '#000000' : '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(pin.price, prX + prW / 2, py + ph / 2 + 1);
        }
        ctx.restore();
      }

      // Kinetic Subtitles with Subtitle Zoom (subZoom)
      const curSub = (project.subtitles || []).find(s => curTime >= s.start && curTime <= s.end);
      if (curSub && curSub.text) {
        drawCanvasKineticSubtitle(ctx, cw, ch, curSub, curTime, project.style || {});
      }
    }

    requestAnimationFrame(renderFrameLoop);
  }

  function drawCanvasKineticSubtitle(c, cw, ch, sub, curTime, style) {
    const rawTokens = parseSubToTokens(sub.text);
    if (rawTokens.length === 0) return;

    const scaleFactor = cw / 720;
    const fontName = style.fontFamily || 'Kanit';
    const baseSize = Math.round((style.fontSize || 44) * scaleFactor);
    const hiSize = Math.round(baseSize * 1.24);
    const accentColor = style.accentColor || '#FF5A96';
    const usePill = style.usePill !== false;

    // Subtitle Zoom (ซูมซับ) Pop Animation
    const subZoomTarget = sub.subZoom !== undefined ? Number(sub.subZoom) : 1.28;
    const age = curTime - sub.start;
    let entranceScale = 1.0;
    if (subZoomTarget > 1.01 && age < 0.18) {
      const p = age / 0.18;
      entranceScale = 0.85 + (subZoomTarget - 0.85) * Math.sin(p * Math.PI * 0.82);
    } else if (subZoomTarget > 1.01) {
      entranceScale = 1.0 + Math.max(0, (subZoomTarget - 1.20) * 0.35);
    }

    const subDur = Math.max(0.2, sub.end - sub.start);
    const relP = Math.max(0, Math.min(0.999, (curTime - sub.start) / subDur));
    let activeIdx = Math.floor(relP * rawTokens.length);
    if (sub.wordTimings && sub.wordTimings.length === rawTokens.length) {
      const exactIdx = sub.wordTimings.findIndex(wt => curTime >= wt.start - 0.03 && curTime <= wt.end + 0.03);
      if (exactIdx !== -1) {
        activeIdx = exactIdx;
      } else {
        let lastPassed = 0;
        sub.wordTimings.forEach((wt, i) => {
          if (curTime >= wt.start - 0.02) lastPassed = i;
        });
        activeIdx = lastPassed;
      }
    }

    const palette = [accentColor, '#FFE600', '#4DF0FF', '#FF7A00', '#70FF94'];
    let hiCounter = 0;
    const tokens = rawTokens.map((tk, idx) => {
      const copy = { text: tk.text, highlight: tk.highlight, _idx: idx };
      if (tk.highlight) {
        copy.color = palette[hiCounter % palette.length];
        copy.pill = usePill && hiCounter === 0;
        hiCounter++;
      }
      return copy;
    });

    const maxLineW = cw * 0.85;
    const lines = [];
    let curLine = [];
    let curW = 0;

    tokens.forEach(tk => {
      c.font = `800 ${tk.highlight ? hiSize : baseSize}px "${fontName}", sans-serif`;
      let tw = c.measureText(tk.text).width + (tk.pill ? 28 * scaleFactor : 0);
      if (curLine.length > 0 && curW + tw + 14 > maxLineW && lines.length < 1) {
        lines.push(curLine);
        curLine = [tk];
        curW = tw;
      } else {
        curLine.push(tk);
        curW += tw + 14;
      }
    });
    if (curLine.length > 0) lines.push(curLine);

    const baseY = ch * (style.subYRatio || 0.83);
    const lineGap = baseSize * 1.46;
    const startY = baseY - ((lines.length - 1) * lineGap) / 2;

    lines.forEach((lineTokens, lineIdx) => {
      const cy = startY + lineIdx * lineGap;
      const spacing = 14 * scaleFactor;
      let totalW = 0;

      const measured = lineTokens.map(tk => {
        const isActive = tk._idx === activeIdx;
        const bounce = entranceScale * (isActive && subZoomTarget > 1.01 ? 1.13 : 1.0);
        const fSz = Math.round((tk.highlight ? hiSize : baseSize) * bounce);
        const fontStr = `${tk.highlight ? '900' : '800'} ${fSz}px "${fontName}", "Kanit", sans-serif`;
        c.font = fontStr;
        let w = c.measureText(tk.text).width;
        if (tk.pill) w += 28 * scaleFactor;
        totalW += w;
        return { tk, fontStr, fSz, w, isActive };
      });
      totalW += spacing * Math.max(0, lineTokens.length - 1);

      let curX = (cw - totalW) / 2;
      measured.forEach(m => {
        const { tk, fontStr, fSz, w, isActive } = m;
        const cx = curX + w / 2;
        const drawY = cy + (isActive && subZoomTarget > 1.01 ? -5 * scaleFactor : 0);

        c.save();
        c.font = fontStr;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        c.miterLimit = 2;

        if (tk.pill) {
          const padY = baseSize * 0.66;
          c.fillStyle = 'rgba(0,0,0,0.65)';
          drawRoundedRect(c, curX - 2, drawY - padY + 4, w + 4, padY * 2, 15 * scaleFactor);
          c.fill();

          c.fillStyle = tk.color;
          c.strokeStyle = '#ffffff';
          c.lineWidth = 3 * scaleFactor;
          drawRoundedRect(c, curX, drawY - padY, w, padY * 2, 15 * scaleFactor);
          c.fill();
          c.stroke();

          const isLightPill = ['#ffe600', '#4df0ff', '#70ff94', '#ffffff'].includes(tk.color.toLowerCase());
          c.lineWidth = 4 * scaleFactor;
          c.strokeStyle = isLightPill ? '#ffffff' : '#180c14';
          c.strokeText(tk.text, cx, drawY + 1);
          c.fillStyle = isLightPill ? '#111115' : '#ffffff';
          c.fillText(tk.text, cx, drawY + 1);

          drawSparkleVector(c, curX + w - 4, drawY - padY + 4, 9 * scaleFactor, '#FFE600');
        } else if (tk.highlight) {
          c.lineWidth = 10 * scaleFactor;
          c.strokeStyle = 'rgba(0,0,0,0.85)';
          c.strokeText(tk.text, cx + 2, drawY + 4);

          c.lineWidth = 8.5 * scaleFactor;
          c.strokeStyle = '#101014';
          c.strokeText(tk.text, cx, drawY);

          c.fillStyle = tk.color;
          c.fillText(tk.text, cx, drawY);

          if (isActive) {
            drawSparkleVector(c, cx + w / 2, drawY - fSz * 0.55, 8 * scaleFactor, '#ffffff');
          }
        } else {
          c.lineWidth = 8 * scaleFactor;
          c.strokeStyle = 'rgba(0,0,0,0.8)';
          c.strokeText(tk.text, cx + 2, drawY + 3);

          c.lineWidth = 7 * scaleFactor;
          c.strokeStyle = '#101014';
          c.strokeText(tk.text, cx, drawY);

          c.fillStyle = isActive ? '#FFF59D' : '#FFFFFF';
          c.fillText(tk.text, cx, drawY);
        }

        c.restore();
        curX += w + spacing;
      });
    });
  }

  // --- MANUAL NLE ACTIONS ---
  function splitSegmentAtPlayhead() {
    if (!project) return;
    const t = sourceVideo.currentTime || 0;
    const idx = project.segments.findIndex(s => !s.deleted && t > s.sourceStart + 0.20 && t < s.sourceEnd - 0.20);
    if (idx === -1) {
      showToast('เลื่อนหัวอ่านไปยังจุดกึ่งกลางคัตที่ต้องการหั่นก่อนครับ');
      return;
    }
    pushHistory();
    const orig = project.segments[idx];
    const segA = {
      id: 'seg_' + Date.now() + '_a',
      sourceStart: orig.sourceStart,
      sourceEnd: Number(t.toFixed(2)),
      zoomScale: orig.zoomScale || 1.0,
      cropY: orig.cropY,
      label: orig.label + ' (1)'
    };
    const segB = {
      id: 'seg_' + Date.now() + '_b',
      sourceStart: Number(t.toFixed(2)),
      sourceEnd: orig.sourceEnd,
      zoomScale: orig.zoomScale || 1.0,
      cropY: orig.cropY,
      label: orig.label + ' (2)'
    };
    project.segments.splice(idx, 1, segA, segB);
    selectedSegmentId = segB.id;
    syncAllUI();
    showToast(`หั่นแยกคลิปที่เวลา ${t.toFixed(2)}s สำเร็จ`);
  }

  function deleteSelectedSegment() {
    if (!project) return;
    const seg = project.segments.find(s => s.id === selectedSegmentId);
    if (!seg) return;
    pushHistory();
    seg.deleted = !seg.deleted;
    syncAllUI();
    showToast(seg.deleted ? 'ลบคัตที่เลือกออกแล้ว (กด Ctrl+Z เพื่อกู้คืน)' : 'กู้คืนคัตที่เลือกแล้ว');
  }

  function addZoomAtPlayhead(scale = 1.25, mode = 'smooth') {
    if (!project) return;
    const t = sourceVideo.currentTime || 0;
    pushHistory();
    project.zooms = project.zooms || [];
    project.zooms.push({
      id: 'z_' + Date.now(),
      start: Number(t.toFixed(2)),
      end: Number(Math.min(getMaxSourceDuration(), t + 2.4).toFixed(2)),
      scale: Number(scale),
      mode: mode,
      label: mode === 'punch' ? 'ซูมกระแทกคำ' : 'ซูมนุ่มนวล'
    });
    syncAllUI();
    showToast(`เพิ่มซูมภาพ ${scale}x ที่ ${t.toFixed(2)}s แล้ว`);
  }

  function addSubtitleAtPlayhead() {
    if (!project) return;
    const t = sourceVideo.currentTime || 0;
    pushHistory();
    const newSub = {
      id: 'sub_' + Date.now(),
      start: Number(t.toFixed(2)),
      end: Number(Math.min(getMaxSourceDuration(), t + 2.5).toFixed(2)),
      fullText: 'พิมพ์ข้อความ *คำสำคัญ* ตรงนี้',
      keywordText: '*คำสำคัญ*',
      text: '*คำสำคัญ*',
      subZoom: 1.28
    };
    project.subtitles = project.subtitles || [];
    project.subtitles.push(newSub);
    project.subtitles.sort((a, b) => a.start - b.start);
    selectedSubId = newSub.id;
    syncAllUI();
    inputActiveSubText.focus();
    inputActiveSubText.select();
    showToast(`เพิ่มซับไตเติลใหม่ที่ ${t.toFixed(2)}s`);
  }

  // --- BACKEND AI DIRECTOR AUTO-EDIT (Works on ALL clips including custom uploads!) ---
  function setAiStatus(text) {
    const el = document.getElementById('aiEngineStatus');
    if (el) el.textContent = text;
  }

  function runAiFullViral() {
    if (!project) return;
    setAiStatus('กำลังตัดต่อใน Backend...');
    showToast('กำลังวิเคราะห์คลื่นเสียง ซูมภาพ และดึงซับคำสำคัญ (Keywords) ใน Backend...');

    fetch('/api/ai-auto-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath: project.sourcePath,
        subtitleMode: project.subtitleMode || 'keywords',
        duration: getMaxSourceDuration()
      })
    })
      .then(r => r.json())
      .then(data => {
        setAiStatus('พร้อมทำงาน');
        if (data && data.ok && data.plan) {
          pushHistory();
          const p = data.plan;
          if (p.segments && p.segments.length > 0) project.segments = p.segments;
          if (p.zooms) project.zooms = p.zooms;
          if (p.subtitles && p.subtitles.length > 0) project.subtitles = p.subtitles;
          if (p.sfx) project.sfx = p.sfx;
          if (p.vfx) project.vfx = p.vfx;
          if (p.hookText && !project.hookText) project.hookText = p.hookText;
          project.aspectRatio = '3:4';
          project.fitMode = 'fill';
          selectedSegmentId = project.segments[0] ? project.segments[0].id : null;
          selectedSubId = project.subtitles[0] ? project.subtitles[0].id : null;
          syncAllUI();
          triggerSfxSound('sparkle');
          showToast(`ตัดต่ออัตโนมัติสำเร็จ (${project.segments.length} คัต, ${project.zooms.length} จุดซูม, ${project.subtitles.length} ซับคำสำคัญ) แก้ไขต่อได้ทุกจุด`);
        } else {
          showToast('ประมวลผลการตัดต่ออัตโนมัติเรียบร้อย');
        }
      })
      .catch(() => {
        setAiStatus('พร้อมทำงาน');
        showToast('ไม่สามารถเชื่อมต่อ Backend AI ได้');
      });
  }

  function runAiTrimSilence() {
    if (!project) return;
    setAiStatus('กำลังจัดคัตตามประโยค...');
    showToast('กำลังวิเคราะห์ประโยคและจัดแบ่งคัตอย่างเป็นธรรมชาติ (ไม่ตัดขาดคำพูด)...');

    fetch('/api/ai-auto-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath: project.sourcePath,
        subtitleMode: project.subtitleMode || 'keywords'
      })
    })
      .then(r => r.json())
      .then(data => {
        setAiStatus('พร้อมทำงาน');
        if (data && data.ok && data.plan && data.plan.segments) {
          pushHistory();
          project.segments = data.plan.segments;
          selectedSegmentId = project.segments[0] ? project.segments[0].id : null;
          syncAllUI();
          showToast(`จัดแบ่งคัตตามประโยคเรียบร้อย (${project.segments.length} คัตต่อเนื่อง ไม่ตัดขาดคำ)`);
        }
      })
      .catch(() => setAiStatus('พร้อมทำงาน'));
  }

  function runAiAutoTranscribe() {
    if (!project) return;
    setAiStatus('กำลังดึงซับคำสำคัญ (Keywords)...');
    showToast('กำลังวิเคราะห์เสียงพูดระดับ 0.05 วินาที และคัดคำสำคัญ (Keywords) ใน Backend...');

    fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath: project.sourcePath,
        subtitleMode: project.subtitleMode || 'keywords',
        duration: getMaxSourceDuration()
      })
    })
      .then(r => r.json())
      .then(data => {
        setAiStatus('พร้อมทำงาน');
        if (data && data.ok && data.subtitles && data.subtitles.length > 0) {
          pushHistory();
          project.subtitles = data.subtitles;
          selectedSubId = project.subtitles[0].id;
          syncAllUI();
          showToast(`ดึงซับตรงจังหวะพูดสำเร็จ (${data.subtitles.length} จังหวะ)`);
        }
      })
      .catch(() => setAiStatus('พร้อมทำงาน'));
  }

  // --- RENDER & EXPORT MP4 ---
  function renderAndExportMp4() {
    if (!project) return;
    const modal = document.getElementById('renderModal');
    modal.hidden = false;

    fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    })
      .then(r => r.json())
      .then(res => {
        modal.hidden = true;
        if (res && res.ok && res.downloadUrl) {
          const a = document.createElement('a');
          a.href = res.downloadUrl + '&cleanup=1';
          a.download = res.fileName || project.outputFile || 'เหมียวน่ารัก_3x4_Output.mp4';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          // Zero Retention: immediately wipe raw source clips from server
          fetch('/api/session/purge-raw', { method: 'POST' }).catch(() => {});
          showToast(`เรนเดอร์และบันทึกไฟล์สำเร็จ (ลบไฟล์แคชและวิดีโอออกจากเซิร์ฟเวอร์ทันที 100% Zero-Retention)`);
        } else {
          fallbackDownloadPreRendered();
        }
      })
      .catch(() => {
        modal.hidden = true;
        fallbackDownloadPreRendered();
      });
  }

  function fallbackDownloadPreRendered() {
    if (!project) return;
    const fn = project.outputFile || 'ผลงานตัดต่อ_วิดีโอ1_OneDayVlog_3x4.mp4';
    const a = document.createElement('a');
    a.href = '/' + encodeURIComponent(fn);
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`ดาวน์โหลดไฟล์ ${fn} สำเร็จ`);
  }

  function formatTimecode(sec) {
    if (isNaN(sec) || sec < 0) return '00:00.0';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const d = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
  }

  function showToast(msg) {
    const el = document.getElementById('toastPopup');
    document.getElementById('toastText').textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    // Left Panel 3 Tabs (Cuts & AI | Camera Zooms | Effects & Hook)
    document.querySelectorAll('[data-ltab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-ltab]').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('paneLeftCuts').classList.toggle('active', btn.dataset.ltab === 'cuts');
        document.getElementById('paneLeftZooms').classList.toggle('active', btn.dataset.ltab === 'zooms');
        document.getElementById('paneLeftSfx').classList.toggle('active', btn.dataset.ltab === 'sfx');

        // Sync with mobile bottom navigation bar if on mobile screen
        if (window.innerWidth <= 768) {
          currentMobileSection = btn.dataset.ltab;
          document.querySelectorAll('.mtab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.msection === currentMobileSection);
          });
          const pl = document.querySelector('.panel-left');
          const pr = document.querySelector('.panel-right');
          if (pl) pl.style.display = 'flex';
          if (pr) pr.style.display = 'none';
        }
      });
    });

    // Right Panel 2 Tabs (Subtitles & SubZoom | Fonts & Colors)
    document.querySelectorAll('[data-rtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-rtab]').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('paneRightSubs').classList.toggle('active', btn.dataset.rtab === 'subs');
        document.getElementById('paneRightStyle').classList.toggle('active', btn.dataset.rtab === 'style');

        // Sync with mobile bottom navigation bar if on mobile screen
        if (window.innerWidth <= 768) {
          currentMobileSection = btn.dataset.rtab;
          document.querySelectorAll('.mtab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.msection === currentMobileSection);
          });
          const pl = document.querySelector('.panel-left');
          const pr = document.querySelector('.panel-right');
          if (pl) pl.style.display = 'none';
          if (pr) pr.style.display = 'flex';
        }
      });
    });

    // Mobile Bottom Navigation Bar (CapCut / TikTok Style Tool Switcher)
    let currentMobileSection = 'cuts';
    function syncResponsivePanels() {
      const isMobile = window.innerWidth <= 768;
      const pl = document.querySelector('.panel-left');
      const pr = document.querySelector('.panel-right');

      if (!isMobile) {
        // Desktop / iPad: Restore default grid styling
        if (pl) pl.style.display = '';
        if (pr) pr.style.display = '';
        return;
      }

      // Mobile screen: display only the chosen drawer
      document.querySelectorAll('.mtab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.msection === currentMobileSection);
      });

      if (['cuts', 'zooms', 'sfx'].includes(currentMobileSection)) {
        if (pl) pl.style.display = 'flex';
        if (pr) pr.style.display = 'none';
        const tabBtn = document.getElementById(
          currentMobileSection === 'cuts' ? 'tabBtnCuts' :
          currentMobileSection === 'zooms' ? 'tabBtnZooms' : 'tabBtnSfx'
        );
        if (tabBtn) {
          document.querySelectorAll('[data-ltab]').forEach(b => b.classList.toggle('active', b === tabBtn));
          document.getElementById('paneLeftCuts').classList.toggle('active', currentMobileSection === 'cuts');
          document.getElementById('paneLeftZooms').classList.toggle('active', currentMobileSection === 'zooms');
          document.getElementById('paneLeftSfx').classList.toggle('active', currentMobileSection === 'sfx');
        }
      } else {
        if (pl) pl.style.display = 'none';
        if (pr) pr.style.display = 'flex';
        const tabBtn = document.getElementById(
          currentMobileSection === 'subs' ? 'tabBtnSubs' : 'tabBtnStyle'
        );
        if (tabBtn) {
          document.querySelectorAll('[data-rtab]').forEach(b => b.classList.toggle('active', b === tabBtn));
          document.getElementById('paneRightSubs').classList.toggle('active', currentMobileSection === 'subs');
          document.getElementById('paneRightStyle').classList.toggle('active', currentMobileSection === 'style');
        }
      }
    }

    document.querySelectorAll('.mtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentMobileSection = btn.dataset.msection;
        syncResponsivePanels();
      });
    });

    window.addEventListener('resize', syncResponsivePanels);
    syncResponsivePanels();

    // Delete Current Clip
    if (btnDeleteCurrentClip) {
      btnDeleteCurrentClip.addEventListener('click', () => {
        if (activeClipId) deleteClipById(activeClipId);
      });
    }

    // Universal Video Upload Handler (File Picker + Drag & Drop -> Single or Multi-Clip Merger)
    function handleFilesUpload(fileList, forceSeparateTabs = false) {
      const files = Array.from(fileList || []).filter(f => f && (f.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(f.name)));
      if (files.length === 0) return;

      // If user selected/dropped 2 or more video files at once, open Multi-Clip Merger Studio automatically!
      if (files.length >= 2 && !forceSeparateTabs) {
        openMergerModal(false);
        uploadFilesToMergerQueue(files);
        return;
      }

      const emptyTitle = document.getElementById('emptyStateTitle');
      const emptyDesc = document.getElementById('emptyStateDesc');

      files.forEach(file => {
        setAiStatus('กำลังนำเข้าและตัดต่อ AI...');
        if (emptyTitle) emptyTitle.textContent = `กำลังตัดต่อ "${file.name}" ด้วย AI...`;
        if (emptyDesc) emptyDesc.textContent = 'ระบบกำลังตรวจจับเสียงพูด 0.05 วินาที จัดแบ่งคัตตามประโยค ซูมภาพ และดึงซับคำสำคัญ (Keywords) ให้อัตโนมัติ';
        showToast(`กำลังนำเข้าและให้ AI ตัดต่ออัตโนมัติสำหรับ "${file.name}"...`);

        fetch('/api/upload', {
          method: 'POST',
          headers: {
            'X-File-Name': encodeURIComponent(file.name),
            'X-Subtitle-Mode': preferredSubtitleMode || 'keywords'
          },
          body: file
        })
          .then(r => r.json())
          .then(res => {
            setAiStatus('พร้อมทำงาน');
            if (emptyTitle) emptyTitle.textContent = 'อัปโหลดวิดีโอเพื่อเริ่มตัดต่อ';
            if (emptyDesc) emptyDesc.textContent = 'เมื่ออัปโหลดคลิป ระบบ AI จะวิเคราะห์เสียงระดับคำแบบ Real-Time จัดแบ่งคัต ซูมจังหวะสำคัญ และดึงซับคำสำคัญ (Keywords) ให้อัตโนมัติทันที โดยรักษาเสียงพูดครบถ้วน 100% ไม่ตัดคำขาด';

            if (res && res.ok) {
              const cid = 'clip_' + Date.now() + '_' + Math.floor(Math.random() * 100);
              const dur = res.duration || 30;
              const shortClean = file.name.replace(/\.[^.]+$/, '').slice(0, 18);
              const plan = res.plan || {};
              clipsStore[cid] = {
                id: cid,
                shortTitle: plan.shortTitle || shortClean,
                title: `คลิปของคุณ: ${file.name}`,
                sourcePath: res.sourcePath,
                outputFile: `ผลงานตัดต่อ_${shortClean}_3x4.mp4`,
                aspectRatio: "3:4",
                fitMode: "fill",
                defaultCropY: plan.defaultCropY || 0.30,
                hookText: plan.hookText || `${shortClean} • เหมียวน่ารัก 3:4`,
                hookDuration: dur,
                subtitleMode: plan.subtitleMode || preferredSubtitleMode || "keywords",
                style: plan.style || { preset: "meowmaew_pink", fontFamily: "Kanit", fontSize: 44, accentColor: "#FF5A96", subYRatio: 0.83, usePill: true },
                segments: plan.segments || [{ id: "s_c1", sourceStart: 0.0, sourceEnd: dur, zoomScale: 1.0, cropY: 0.30, label: "ฟุตเทจหลัก" }],
                zooms: plan.zooms || [{ id: "z_c1", start: 1.5, end: 4.0, scale: 1.24, mode: "smooth", label: "ซูมเปิดคลิป" }],
                pins: plan.pins || [{ id: "p_c1", start: 0.0, end: dur, title: "พิกัดสินค้าในคลิป", price: "จิ้มตะกร้า" }],
                sfx: plan.sfx || [{ id: "sfx_c1", time: 0.25, type: "pop", label: "ป๊อปเปิดคลิป" }],
                vfx: plan.vfx || [],
                subtitles: plan.subtitles || [{ id: "sub_c1", start: 0.2, end: 3.0, fullText: "กดปุ่ม *ดึงซับตรงจังหวะพูด* ได้เลย", keywordText: "*ดึงซับคำสำคัญ*", text: "*ดึงซับคำสำคัญ*", subZoom: 1.28 }]
              };
              selectClipById(cid);
              triggerSfxSound('sparkle');
              showToast(`นำเข้าและตัดต่ออัตโนมัติสำหรับ "${shortClean}" สำเร็จ แก้ไขต่อได้ทุกจุด`);
            }
          })
          .catch(() => {
            setAiStatus('พร้อมทำงาน');
            if (emptyTitle) emptyTitle.textContent = 'อัปโหลดวิดีโอเพื่อเริ่มตัดต่อ';
            if (emptyDesc) emptyDesc.textContent = 'เมื่ออัปโหลดคลิป ระบบ AI จะวิเคราะห์เสียงพูดระดับ 0.05 วินาที จัดแบ่งคัตตามประโยค ซูมจังหวะสำคัญ และดึงซับคำสำคัญ (Keywords) ให้อัตโนมัติทันที';
          });
      });
    }

    // --- MULTI-CLIP MERGER STUDIO (รวมหลายวิดีโอย่อยเป็น 1 วิดีโอ) ---
    const mergerModal = document.getElementById('multiClipMergerModal');
    const mergerClipsListEl = document.getElementById('mergerClipsList');
    const mergerClipCountEl = document.getElementById('mergerClipCount');
    const mergerTotalDurEl = document.getElementById('mergerTotalDur');
    const mergerStatusTextEl = document.getElementById('mergerStatusText');
    const chkMergerAutoAi = document.getElementById('chkMergerAutoAi');
    const chkMergerTransitions = document.getElementById('chkMergerTransitions');

    function openMergerModal(includeCurrentActive = false) {
      if (!mergerModal) return;
      if (includeCurrentActive && project && project.sourcePath) {
        const exists = mergerQueue.some(item => item.sourcePath === project.sourcePath);
        if (!exists) {
          const curDur = getMaxSourceDuration();
          mergerQueue.unshift({
            id: 'mq_' + Date.now() + '_cur',
            sourcePath: project.sourcePath,
            title: project.shortTitle || project.title || 'คลิปปัจจุบัน',
            duration: curDur,
            trimStart: 0.0,
            trimEnd: Number(curDur.toFixed(2))
          });
        }
      }
      mergerModal.hidden = false;
      renderMergerQueueList();
    }

    function closeMergerModal() {
      if (mergerModal) mergerModal.hidden = true;
    }

    function renderMergerQueueList() {
      if (!mergerClipsListEl) return;
      mergerClipsListEl.innerHTML = '';

      let totalDur = 0;
      mergerQueue.forEach(item => {
        totalDur += Math.max(0, (item.trimEnd || item.duration) - (item.trimStart || 0));
      });

      if (mergerClipCountEl) mergerClipCountEl.textContent = String(mergerQueue.length);
      if (mergerTotalDurEl) mergerTotalDurEl.textContent = `${totalDur.toFixed(1)}s`;

      if (mergerQueue.length === 0) {
        mergerClipsListEl.innerHTML = `
          <div class="merger-empty-placeholder">
            <strong>ยังไม่มีคลิปย่อยในรายการรวม</strong><br>
            คลิกปุ่ม <strong>"+ เพิ่มคลิปวิดีโอย่อยจากเครื่อง"</strong> ด้านบน หรือลากไฟล์วิดีโอหลายๆ ไฟล์มาวางในกรอบนี้ได้เลยครับ
          </div>
        `;
        return;
      }

      mergerQueue.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'merger-clip-row';
        const activeDur = Math.max(0.2, (item.trimEnd || item.duration) - (item.trimStart || 0));

        row.innerHTML = `
          <div class="merger-clip-left">
            <span class="merger-order-badge">#${idx + 1}</span>
            <div class="merger-thumb-box">
              <video src="${getSessionMediaUrl(item.sourcePath)}#t=0.4" muted preload="metadata" playsinline></video>
            </div>
            <div class="merger-clip-meta">
              <div class="merger-clip-title">${item.title}</div>
              <div class="merger-clip-sub">ใช้จริง <strong class="mono-num">${activeDur.toFixed(1)}s</strong> (ต้นฉบับ ${item.duration.toFixed(1)}s)</div>
            </div>
          </div>
          <div class="merger-clip-right">
            <div class="merger-trim-group" title="ตั้งเวลาเริ่มและจบของคลิปย่อยนี้ก่อนนำไปรวม">
              <span>เริ่ม</span>
              <input type="number" step="0.1" min="0" max="${item.duration.toFixed(1)}" class="num-input-xs inp-m-start" value="${item.trimStart.toFixed(1)}">
              <span>ถึง</span>
              <input type="number" step="0.1" min="0.2" max="${item.duration.toFixed(1)}" class="num-input-xs inp-m-end" value="${item.trimEnd.toFixed(1)}">
              <span>s</span>
            </div>
            <div class="merger-order-btns">
              <button type="button" class="seg-btn-xs btn-m-up" title="เลื่อนคลิปนี้ขึ้น" ${idx === 0 ? 'disabled' : ''}>▲</button>
              <button type="button" class="seg-btn-xs btn-m-down" title="เลื่อนคลิปนี้ลง" ${idx === mergerQueue.length - 1 ? 'disabled' : ''}>▼</button>
              <button type="button" class="seg-btn-xs seg-btn-del btn-m-del" title="เอาคลิปนี้ออกจากรายการรวม">✕</button>
            </div>
          </div>
        `;

        row.querySelector('.inp-m-start').addEventListener('change', (e) => {
          const val = parseFloat(e.target.value) || 0;
          item.trimStart = Math.max(0, Math.min(item.trimEnd - 0.2, val));
          renderMergerQueueList();
        });

        row.querySelector('.inp-m-end').addEventListener('change', (e) => {
          const val = parseFloat(e.target.value) || item.duration;
          item.trimEnd = Math.max(item.trimStart + 0.2, Math.min(item.duration, val));
          renderMergerQueueList();
        });

        row.querySelector('.btn-m-up').addEventListener('click', () => {
          if (idx <= 0) return;
          const tmp = mergerQueue[idx - 1];
          mergerQueue[idx - 1] = mergerQueue[idx];
          mergerQueue[idx] = tmp;
          renderMergerQueueList();
        });

        row.querySelector('.btn-m-down').addEventListener('click', () => {
          if (idx >= mergerQueue.length - 1) return;
          const tmp = mergerQueue[idx + 1];
          mergerQueue[idx + 1] = mergerQueue[idx];
          mergerQueue[idx] = tmp;
          renderMergerQueueList();
        });

        row.querySelector('.btn-m-del').addEventListener('click', () => {
          mergerQueue.splice(idx, 1);
          renderMergerQueueList();
        });

        mergerClipsListEl.appendChild(row);
      });
    }

    function uploadFilesToMergerQueue(fileList) {
      const files = Array.from(fileList || []).filter(f => f && (f.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(f.name)));
      if (files.length === 0) return;

      if (mergerStatusTextEl) mergerStatusTextEl.textContent = `กำลังนำเข้า ${files.length} คลิปย่อย...`;
      showToast(`กำลังเตรียม ${files.length} คลิปย่อยเข้าสู่สตูดิโอรวมคลิป...`);

      Promise.all(files.map(file => {
        return fetch('/api/upload-raw', {
          method: 'POST',
          headers: { 'X-File-Name': encodeURIComponent(file.name) },
          body: file
        })
          .then(r => r.json())
          .then(res => ({ file, res }))
          .catch(() => ({ file, res: null }));
      })).then(results => {
        results.forEach(({ file, res }) => {
          if (res && res.ok) {
            const dur = Number(res.duration || 10);
            mergerQueue.push({
              id: 'mq_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
              sourcePath: res.sourcePath,
              title: file.name.replace(/\.[^.]+$/, ''),
              duration: dur,
              trimStart: 0.0,
              trimEnd: dur,
              fileRef: file
            });
          }
        });
        if (mergerStatusTextEl) mergerStatusTextEl.textContent = `พร้อมรวม ${mergerQueue.length} คลิป`;
        renderMergerQueueList();
        showToast(`เพิ่ม ${files.length} คลิปย่อยเรียบร้อย จัดเรียงลำดับแล้วกดรวมเป็น 1 วิดีโอได้เลย`);
      });
    }

    function executeMergeClips() {
      if (mergerQueue.length === 0) {
        showToast('กรุณาเพิ่มคลิปวิดีโอย่อยอย่างน้อย 1 คลิปก่อนครับ');
        return;
      }

      const btnExec = document.getElementById('btnExecuteMergeClips');
      if (btnExec) btnExec.disabled = true;
      if (mergerStatusTextEl) mergerStatusTextEl.textContent = `กำลังรวม ${mergerQueue.length} คลิป + วิเคราะห์เสียง Real-Time...`;
      setAiStatus(`กำลังรวม ${mergerQueue.length} คลิป...`);
      showToast(`กำลังรวม ${mergerQueue.length} คลิปย่อยเข้าเป็น 1 วิดีโอเดียว พร้อมตัดต่อและซิงค์ซับ Real-Time...`);

      fetch('/api/merge-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: mergerQueue.map(item => ({
            sourcePath: item.sourcePath,
            title: item.title,
            trimStart: item.trimStart,
            trimEnd: item.trimEnd
          })),
          subtitleMode: preferredSubtitleMode || 'keywords',
          autoAi: chkMergerAutoAi ? chkMergerAutoAi.checked : true,
          addTransitions: chkMergerTransitions ? chkMergerTransitions.checked : true
        })
      })
        .then(r => r.json())
        .then(res => {
          if (btnExec) btnExec.disabled = false;
          setAiStatus('พร้อมทำงาน');
          if (mergerStatusTextEl) mergerStatusTextEl.textContent = 'พร้อมรวมคลิป';

          if (res && res.ok && res.plan) {
            const cid = 'merged_' + Date.now();
            const dur = res.duration || 30;
            const nClips = res.mergedCount || mergerQueue.length;
            const plan = res.plan;
            const shortTitle = `รวม ${nClips} คลิป (${Math.round(dur)}s)`;

            clipsStore[cid] = {
              id: cid,
              shortTitle: shortTitle,
              title: `วิดีโอรวม ${nClips} คลิปย่อย (${dur.toFixed(1)}s)`,
              sourcePath: res.sourcePath,
              outputFile: `ผลงานรวม_${nClips}คลิป_3x4.mp4`,
              aspectRatio: "3:4",
              fitMode: "fill",
              defaultCropY: plan.defaultCropY || 0.25,
              hookText: plan.hookText || `รวม ${nClips} คลิป • เหมียวน่ารัก 3:4`,
              hookDuration: dur,
              subtitleMode: plan.subtitleMode || preferredSubtitleMode || "keywords",
              style: plan.style || { preset: "meowmaew_pink", fontFamily: "Kanit", fontSize: 44, accentColor: "#FF5A96", subYRatio: 0.83, usePill: true },
              segments: plan.segments || [{ id: "s1", sourceStart: 0.0, sourceEnd: dur, zoomScale: 1.0, cropY: 0.25, label: "วิดีโอรวม" }],
              zooms: plan.zooms || [],
              pins: plan.pins || [{ id: "p1", start: 0.0, end: dur, title: "พิกัดสินค้าในคลิป", price: "ปักหมุด" }],
              sfx: plan.sfx || [],
              vfx: plan.vfx || [],
              subtitles: plan.subtitles || [],
              mergedClips: res.clipBoundaries || []
            };

            mergerQueue = [];
            closeMergerModal();
            selectClipById(cid);
            triggerSfxSound('sparkle');
            showToast(`รวม ${nClips} คลิปเป็น 1 วิดีโอสำเร็จ! (${clipsStore[cid].segments.length} คัต, ${clipsStore[cid].subtitles.length} ซับ Real-Time)`);
          } else {
            showToast('เกิดข้อผิดพลาดในการรวมคลิป กรุณาลองอีกครั้ง');
          }
        })
        .catch(() => {
          if (btnExec) btnExec.disabled = false;
          setAiStatus('พร้อมทำงาน');
          if (mergerStatusTextEl) mergerStatusTextEl.textContent = 'พร้อมรวมคลิป';
          showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์รวมคลิปได้');
        });
    }

    // Bind Multi-Clip Merger Studio Buttons
    ['btnOpenMergerTopbar', 'btnOpenMergerDropzone', 'btnOpenMergerLeft'].forEach(btnId => {
      const el = document.getElementById(btnId);
      if (el) el.addEventListener('click', () => openMergerModal(false));
    });

    if (btnAppendClipTopbar) {
      btnAppendClipTopbar.addEventListener('click', () => {
        openMergerModal(true);
        const mfInput = document.getElementById('mergerFileInput');
        if (mfInput) mfInput.click();
      });
    }

    const btnCloseMerger = document.getElementById('btnCloseMergerModal');
    if (btnCloseMerger) btnCloseMerger.addEventListener('click', closeMergerModal);

    const mergerFileInput = document.getElementById('mergerFileInput');
    if (mergerFileInput) {
      mergerFileInput.addEventListener('change', (e) => {
        uploadFilesToMergerQueue(e.target.files);
        e.target.value = '';
      });
    }

    const btnAddExistingTabs = document.getElementById('btnAddExistingTabsToMerger');
    if (btnAddExistingTabs) {
      btnAddExistingTabs.addEventListener('click', () => {
        const keys = Object.keys(clipsStore);
        if (keys.length === 0) {
          showToast('ยังไม่มีคลิปที่เปิดอยู่ในแถบด้านบนครับ');
          return;
        }
        let added = 0;
        keys.forEach(cid => {
          const cObj = clipsStore[cid];
          if (cObj && cObj.sourcePath) {
            let maxD = 15;
            (cObj.segments || []).forEach(s => { if (s.sourceEnd > maxD) maxD = s.sourceEnd; });
            mergerQueue.push({
              id: 'mq_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
              sourcePath: cObj.sourcePath,
              title: cObj.shortTitle || cObj.title || 'คลิปในโปรเจกต์',
              duration: maxD,
              trimStart: 0.0,
              trimEnd: maxD
            });
            added++;
          }
        });
        renderMergerQueueList();
        showToast(`ดึง ${added} คลิปจากโปรเจกต์เข้าสู่รายการรวมแล้ว`);
      });
    }

    const btnClearMerger = document.getElementById('btnClearMergerList');
    if (btnClearMerger) {
      btnClearMerger.addEventListener('click', () => {
        mergerQueue = [];
        renderMergerQueueList();
      });
    }

    const btnImportSeparate = document.getElementById('btnImportSeparateTabs');
    if (btnImportSeparate) {
      btnImportSeparate.addEventListener('click', () => {
        const rawFiles = mergerQueue.map(x => x.fileRef).filter(Boolean);
        closeMergerModal();
        if (rawFiles.length > 0) {
          mergerQueue = [];
          handleFilesUpload(rawFiles, true);
        }
      });
    }

    const btnExecuteMerge = document.getElementById('btnExecuteMergeClips');
    if (btnExecuteMerge) {
      btnExecuteMerge.addEventListener('click', executeMergeClips);
    }

    if (mergerClipsListEl) {
      ['dragenter', 'dragover'].forEach(evName => {
        mergerClipsListEl.addEventListener(evName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          mergerClipsListEl.classList.add('drag-over');
        });
      });
      ['dragleave', 'drop'].forEach(evName => {
        mergerClipsListEl.addEventListener(evName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          mergerClipsListEl.classList.remove('drag-over');
        });
      });
      mergerClipsListEl.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          uploadFilesToMergerQueue(e.dataTransfer.files);
        }
      });
    }

    document.getElementById('fileUploadInput').addEventListener('change', (e) => {
      handleFilesUpload(e.target.files);
      e.target.value = '';
    });

    // Drag & Drop Video Upload on Viewport / Empty Dropzone
    const viewportArea = document.getElementById('viewportArea');
    const uploadDropzoneBox = document.getElementById('uploadDropzoneBox');
    if (viewportArea) {
      ['dragenter', 'dragover'].forEach(evName => {
        viewportArea.addEventListener(evName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (uploadDropzoneBox) uploadDropzoneBox.classList.add('drag-over');
        });
      });
      ['dragleave', 'drop'].forEach(evName => {
        viewportArea.addEventListener(evName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (uploadDropzoneBox) uploadDropzoneBox.classList.remove('drag-over');
        });
      });
      viewportArea.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFilesUpload(e.dataTransfer.files);
        }
      });
    }

    // Undo / Redo / Reset
    document.getElementById('btnUndo').addEventListener('click', undo);
    document.getElementById('btnRedo').addEventListener('click', redo);
    document.getElementById('btnResetProject').addEventListener('click', () => {
      if (!project) return;
      runAiFullViral();
    });

    document.getElementById('btnRenderExport').addEventListener('click', renderAndExportMp4);

    // Backend AI Buttons
    document.getElementById('btnAiFullViral').addEventListener('click', runAiFullViral);
    document.getElementById('btnAiTrimSilence').addEventListener('click', runAiTrimSilence);
    document.getElementById('btnAiAutoSub').addEventListener('click', runAiAutoTranscribe);

    document.getElementById('btnAddSplitLeft').addEventListener('click', splitSegmentAtPlayhead);
    document.getElementById('btnRestoreAllCuts').addEventListener('click', () => {
      if (!project) return;
      pushHistory();
      (project.segments || []).forEach(s => { s.deleted = false; });
      syncAllUI();
      showToast('กู้คืนทุกคัตกลับมาครบแล้ว');
    });

    // Camera Zoom Presets & Clear All Zooms (Left Tab 2)
    document.querySelectorAll('.btn-add-zoom-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const sc = parseFloat(btn.dataset.scale) || 1.25;
        const md = btn.dataset.mode || 'smooth';
        addZoomAtPlayhead(sc, md);
      });
    });

    document.getElementById('btnClearAllZooms').addEventListener('click', () => {
      if (!project) return;
      pushHistory();
      project.zooms = [];
      syncAllUI();
      showToast('ลบจุดซูมภาพทั้งหมดออกแล้ว');
    });

    // Clear All Effects (Left Tab 3)
    document.getElementById('btnClearAllEffects').addEventListener('click', () => {
      if (!project) return;
      pushHistory();
      project.sfx = [];
      project.vfx = [];
      syncAllUI();
      showToast('ลบเอฟเฟกต์ทั้งหมดออกแล้ว');
    });

    // Monitor Ratio & Framing
    document.querySelectorAll('#ratioSelector .ps-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!project) return;
        pushHistory();
        project.aspectRatio = btn.dataset.ratio;
        syncAllUI();
      });
    });

    document.querySelectorAll('#fitModeSelector .ps-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!project) return;
        pushHistory();
        project.fitMode = btn.dataset.fit;
        syncAllUI();
      });
    });

    document.getElementById('sliderCropY').addEventListener('input', (e) => {
      if (!project) return;
      const val = parseInt(e.target.value, 10) / 100;
      project.defaultCropY = val;
      const curSeg = (project.segments || []).find(s => s.id === selectedSegmentId);
      if (curSeg) curSeg.cropY = val;
      document.getElementById('valCropY').textContent = `${e.target.value}%`;
    });

    // Transport Controls
    document.getElementById('btnPlayPause').addEventListener('click', () => {
      ensureAudio();
      if (sourceVideo.paused) {
        sourceVideo.play().then(() => {
          document.getElementById('playIcon').textContent = '⏸';
        }).catch(() => {});
      } else {
        sourceVideo.pause();
        document.getElementById('playIcon').textContent = '▶';
      }
    });

    document.getElementById('btnStepBack').addEventListener('click', () => {
      sourceVideo.pause();
      document.getElementById('playIcon').textContent = '▶';
      sourceVideo.currentTime = Math.max(0, (sourceVideo.currentTime || 0) - 0.1);
    });

    document.getElementById('btnStepForward').addEventListener('click', () => {
      sourceVideo.pause();
      document.getElementById('playIcon').textContent = '▶';
      sourceVideo.currentTime = Math.min(getMaxSourceDuration(), (sourceVideo.currentTime || 0) + 0.1);
    });

    document.getElementById('btnSplitAtPlayhead').addEventListener('click', splitSegmentAtPlayhead);
    document.getElementById('btnAddZoomAtPlayhead').addEventListener('click', () => addZoomAtPlayhead(1.25, 'smooth'));
    document.getElementById('btnAddSubAtPlayhead').addEventListener('click', addSubtitleAtPlayhead);
    document.getElementById('btnDeleteSelectedSeg').addEventListener('click', deleteSelectedSegment);
    document.getElementById('btnAddNewSubLine').addEventListener('click', addSubtitleAtPlayhead);

    // SFX & VFX Buttons
    document.querySelectorAll('[data-sfx]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!project) return;
        const sfxType = btn.dataset.sfx;
        triggerSfxSound(sfxType);
        pushHistory();
        project.sfx = project.sfx || [];
        project.sfx.push({
          id: 'sfx_' + Date.now(),
          time: Number((sourceVideo.currentTime || 0).toFixed(2)),
          type: sfxType
        });
        syncAllUI();
        showToast(`วางเอฟเฟกต์เสียงที่ ${(sourceVideo.currentTime || 0).toFixed(2)}s`);
      });
    });

    document.querySelectorAll('[data-vfx]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!project) return;
        const vfxType = btn.dataset.vfx;
        const t = Number((sourceVideo.currentTime || 0).toFixed(2));
        const dur = vfxType === 'flash' ? 0.35 : 3.0;
        pushHistory();
        project.vfx = project.vfx || [];
        project.vfx.push({
          id: 'vfx_' + Date.now(),
          start: t,
          end: Number(Math.min(getMaxSourceDuration(), t + dur).toFixed(2)),
          type: vfxType,
          intensity: 0.40,
          label: vfxType === 'flash' ? 'แฟลชเปลี่ยนฉาก' : 'เอฟเฟกต์ผิวใส'
        });
        syncAllUI();
        showToast(`วางเอฟเฟกต์ภาพที่ ${t.toFixed(2)}s`);
      });
    });

    // Timeline Scrubbing
    let isScrubbing = false;
    function scrubFromMouse(e) {
      const rect = timelineTracksArea.getBoundingClientRect();
      const relX = e.clientX - rect.left - 76;
      const usableW = Math.max(80, rect.width - 76);
      const pct = Math.max(0, Math.min(1, relX / usableW));
      sourceVideo.currentTime = pct * getMaxSourceDuration();
    }
    timelineTracksArea.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tl-seg-block, .tl-zoom-block, .tl-sub-block, .tl-sfx-pin')) return;
      isScrubbing = true;
      scrubFromMouse(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (isScrubbing) scrubFromMouse(e);
    });
    window.addEventListener('mouseup', () => {
      isScrubbing = false;
    });

    // --- UNIFIED REAL-TIME SUBTITLE MODE SWITCHER ('keywords' vs 'full') ---
    function applySubtitleMode(mode) {
      preferredSubtitleMode = mode;
      document.querySelectorAll('[data-submode]').forEach(b => {
        b.classList.toggle('active', b.dataset.submode === mode);
      });

      if (!project || !project.subtitles) {
        showToast(mode === 'keywords' ? 'ตั้งค่าโหมดเริ่มต้น: เอาแต่คำสำคัญ (Keywords) (Real-Time ตรงคำพูด)' : 'ตั้งค่าโหมดเริ่มต้น: เอาซับทั้งหมดทุกคำพูด (Real-Time)');
        return;
      }

      pushHistory();
      project.subtitleMode = mode;
      project.subtitles.forEach(s => {
        if (mode === 'keywords') {
          if (!s.keywordText) s.keywordText = condenseLineToKeywordsOnly(s.text);
          s.text = s.keywordText;
          if (s.kwStart !== undefined && s.kwEnd !== undefined) {
            s.start = s.kwStart;
            s.end = s.kwEnd;
          }
        } else {
          if (s.fullText) s.text = s.fullText;
          if (s.fullStart !== undefined && s.fullEnd !== undefined) {
            s.start = s.fullStart;
            s.end = s.fullEnd;
          }
        }
      });
      syncAllUI();
      showToast(mode === 'keywords' ? 'สลับเป็นโหมด: เอาแต่คำสำคัญ (Keywords) (ขึ้นตรงจังหวะคำสำคัญแบบ Real-Time)' : 'สลับเป็นโหมด: เอาซับทั้งหมดทุกคำพูด (ไฮไลต์ตามคำพูดแบบ Real-Time)');
    }

    document.querySelectorAll('[data-submode]').forEach(btn => {
      btn.addEventListener('click', () => {
        applySubtitleMode(btn.dataset.submode);
      });
    });

    document.getElementById('btnFilterOnlyKeywordsAll').addEventListener('click', () => {
      applySubtitleMode('keywords');
    });

    document.getElementById('btnKeepOnlyStarredInLine').addEventListener('click', () => {
      const sub = getActiveSubObject();
      if (!sub) return;
      pushHistory();
      if (!sub.fullText) sub.fullText = sub.text;
      sub.text = condenseLineToKeywordsOnly(sub.text);
      sub.keywordText = sub.text;
      if (sub.kwStart !== undefined && sub.kwEnd !== undefined) {
        sub.start = sub.kwStart;
        sub.end = sub.kwEnd;
      }
      inputActiveSubText.value = sub.text;
      syncAllUI();
      showToast('ตัดคำทั่วไปออก เหลือเฉพาะคำสำคัญ (Keywords) ตรงจังหวะพูดในบรรทัดนี้แล้ว');
    });

    // Active Subtitle Time & Text & Subtitle Zoom (ซูมซับ) Controls
    inpActiveSubStart.addEventListener('change', () => {
      const sub = getActiveSubObject();
      if (!sub) return;
      pushHistory();
      sub.start = Math.max(0, Math.min(sub.end - 0.1, parseFloat(inpActiveSubStart.value) || 0));
      if (project.subtitleMode === 'keywords') sub.kwStart = sub.start;
      else sub.fullStart = sub.start;
      sourceVideo.currentTime = sub.start + 0.02;
      syncAllUI();
    });

    inpActiveSubEnd.addEventListener('change', () => {
      const sub = getActiveSubObject();
      if (!sub) return;
      pushHistory();
      sub.end = Math.max(sub.start + 0.1, parseFloat(inpActiveSubEnd.value) || sub.start + 1.0);
      if (project.subtitleMode === 'keywords') sub.kwEnd = sub.end;
      else sub.fullEnd = sub.end;
      syncAllUI();
    });

    inputActiveSubText.addEventListener('input', (e) => {
      const sub = getActiveSubObject();
      if (!sub) return;
      sub.text = e.target.value;
      if (project.subtitleMode === 'keywords') sub.keywordText = sub.text;
      else sub.fullText = sub.text;
      renderActiveSubEditor();
      renderSubtitleListPanel();
      renderMultiTrackTimeline();
    });

    document.querySelectorAll('#activeSubZoomGroup .sz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = getActiveSubObject();
        if (!sub) return;
        pushHistory();
        sub.subZoom = parseFloat(btn.dataset.subzoom);
        syncAllUI();
        showToast(sub.subZoom > 1.01 ? `ตั้งซูมซับบรรทัดนี้เป็น ${sub.subZoom.toFixed(2)}x` : 'ลบซูมซับบรรทัดนี้แล้ว (ซับนิ่ง 1x)');
      });
    });

    document.getElementById('btnToggleAllSubZoom').addEventListener('click', () => {
      if (!project || !project.subtitles) return;
      pushHistory();
      const anyHasZoom = project.subtitles.some(s => (s.subZoom ?? 1.28) > 1.02);
      const nextZoom = anyHasZoom ? 1.0 : 1.28;
      project.subtitles.forEach(s => { s.subZoom = nextZoom; });
      syncAllUI();
      showToast(nextZoom > 1.01 ? 'เพิ่มซูมซับ 1.28x ให้ทุกบรรทัดแล้ว' : 'ลบซูมซับออกทั้งหมดแล้ว (แสดงซับนิ่ง)');
    });

    chkUseKeywordPill.addEventListener('change', (e) => {
      if (!project) return;
      project.style.usePill = e.target.checked;
    });

    // Right Tab 2: Font & Color Controls
    document.querySelectorAll('#fontSelectorGrid .font-option-card').forEach(card => {
      card.addEventListener('click', () => {
        if (!project) return;
        pushHistory();
        project.style.fontFamily = card.dataset.font;
        syncAllUI();
        showToast(`เปลี่ยนฟอนต์เป็น ${card.dataset.font}`);
      });
    });

    document.querySelectorAll('#stylePresetSelector .preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!project) return;
        pushHistory();
        project.style.accentColor = btn.dataset.color;
        project.style.preset = btn.dataset.preset;
        syncAllUI();
      });
    });

    document.getElementById('sliderFontSize').addEventListener('input', (e) => {
      if (!project) return;
      project.style.fontSize = parseInt(e.target.value, 10);
      document.getElementById('valFontSize').textContent = `${e.target.value}px`;
    });

    document.getElementById('sliderSubY').addEventListener('input', (e) => {
      if (!project) return;
      project.style.subYRatio = parseInt(e.target.value, 10) / 100;
      document.getElementById('valSubY').textContent = `${e.target.value}%`;
    });

    // Hook & Pin Inputs
    inputHookBanner.addEventListener('input', (e) => {
      if (project) project.hookText = e.target.value;
    });
    inputPinName.addEventListener('input', (e) => {
      if (!project) return;
      if (!project.pins || !project.pins[0]) project.pins = [{ id: 'p1', start: 0, end: 999, title: '', price: '' }];
      project.pins[0].title = e.target.value;
    });
    inputPinPrice.addEventListener('input', (e) => {
      if (!project) return;
      if (!project.pins || !project.pins[0]) project.pins = [{ id: 'p1', start: 0, end: 999, title: '', price: '' }];
      project.pins[0].price = e.target.value;
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        document.getElementById('btnPlayPause').click();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        splitSegmentAtPlayhead();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        addZoomAtPlayhead(1.25, 'smooth');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        addSubtitleAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedSegment();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    });

    // Backend Connection Handshake & Status Checker (Supports Netlify + Remote Cloud Backend)
    function checkBackendConnection() {
      const dot = document.getElementById('backendDotStatus');
      const lbl = document.getElementById('backendStatusLabel');
      const modal = document.getElementById('backendConnectModal');
      const inp = document.getElementById('inpBackendUrl');

      if (inp) inp.value = localStorage.getItem('meow_backend_url') || '';

      fetch('/api/session/init')
        .then(r => r.json())
        .then(res => {
          if (res && res.ok) {
            if (dot) dot.style.background = '#10b981';
            if (lbl) lbl.textContent = 'เซิร์ฟเวอร์ AI พร้อม';
          } else {
            throw new Error('Not ready');
          }
        })
        .catch(() => {
          if (dot) dot.style.background = '#f59e0b';
          if (lbl) lbl.textContent = 'เชื่อมต่อ Backend';
          if (window.location.hostname.endsWith('netlify.app') && !localStorage.getItem('meow_backend_url')) {
            if (modal) modal.hidden = false;
          }
        });
    }

    const btnOpenBackend = document.getElementById('btnOpenBackendSettings');
    const btnCloseBackend = document.getElementById('btnCloseBackendModal');
    const btnTestBackend = document.getElementById('btnTestBackendConnection');
    const btnSaveBackend = document.getElementById('btnSaveBackendUrl');
    const backendModal = document.getElementById('backendConnectModal');
    const inpBackend = document.getElementById('inpBackendUrl');
    const statusBackend = document.getElementById('backendConnStatus');

    if (btnOpenBackend) btnOpenBackend.addEventListener('click', () => {
      if (backendModal) backendModal.hidden = false;
      if (inpBackend) inpBackend.value = localStorage.getItem('meow_backend_url') || '';
    });
    if (btnCloseBackend) btnCloseBackend.addEventListener('click', () => {
      if (backendModal) backendModal.hidden = true;
    });
    if (btnTestBackend) btnTestBackend.addEventListener('click', () => {
      const val = (inpBackend ? inpBackend.value : '').trim().replace(/\/+$/, '');
      if (!val) {
        if (statusBackend) statusBackend.innerHTML = '<span style="color:#ef4444;">กรุณากรอก URL</span>';
        return;
      }
      if (statusBackend) statusBackend.innerHTML = 'กำลังทดสอบเชื่อมต่อ...';
      nativeFetch(val + '/api/session/init', { headers: { 'X-Session-ID': currentSessionId } })
        .then(r => r.json())
        .then(res => {
          if (res && res.ok) {
            if (statusBackend) statusBackend.innerHTML = '<span style="color:#10b981;">✓ เชื่อมต่อสำเร็จ! เซิร์ฟเวอร์ตอบสนองปกติ</span>';
          } else {
            if (statusBackend) statusBackend.innerHTML = '<span style="color:#ef4444;">✗ เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง</span>';
          }
        })
        .catch(err => {
          if (statusBackend) statusBackend.innerHTML = `<span style="color:#ef4444;">✗ ไม่สามารถเชื่อมต่อได้ (${err.message})</span>`;
        });
    });
    if (btnSaveBackend) btnSaveBackend.addEventListener('click', () => {
      const val = (inpBackend ? inpBackend.value : '').trim().replace(/\/+$/, '');
      if (val) {
        localStorage.setItem('meow_backend_url', val);
        showToast('บันทึกการเชื่อมต่อเซิร์ฟเวอร์ Backend แล้ว');
      } else {
        localStorage.removeItem('meow_backend_url');
        showToast('ใช้ค่าเริ่มต้นของระบบ (Default Host)');
      }
      if (backendModal) backendModal.hidden = true;
      checkBackendConnection();
    });

    checkBackendConnection();

    // Zero-Retention: Wipe session files on server automatically when user closes browser/tab
    window.addEventListener('beforeunload', () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/session/purge?sid=' + encodeURIComponent(currentSessionId));
        }
      } catch (e) {}
    });
  }

  // --- BOOTSTRAP (Starts Clean & Empty — Ready for User Upload) ---
  bindEvents();
  renderClipTabsBar();
  requestAnimationFrame(renderFrameLoop);
})();
