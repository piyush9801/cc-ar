/* ═══════════════════════════════════════════════════════════════════
   CURL CULT · AR EXPERIENCE APP.JS
   8-screen state machine · no scan · no gate · direct entry
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const TOTAL_SCREENS = 8;
  let currentScreen = 1;

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ───────────────────────────────────────────────────────────────
  // ANALYTICS + ON-SCREEN DEBUG CONSOLE (mobile users can't see devtools)
  // ───────────────────────────────────────────────────────────────
  const track = (event, props = {}) => {
    const payload = { event, ts: Date.now(), ...props };
    console.log('[analytics]', payload);
    try {
      const log = JSON.parse(localStorage.getItem('curlcult_events') || '[]');
      log.push(payload);
      localStorage.setItem('curlcult_events', JSON.stringify(log.slice(-100)));
    } catch (_) {}
  };

  // ───────────────────────────────────────────────────────────────
  // FREE API: DYNAMIC QR CODE GENERATOR (DESKTOP AR HANDOFF)
  // ───────────────────────────────────────────────────────────────
  window.triggerARFallback = function() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      document.querySelector('#chair-model').activateAR();
    } else {
      const button = document.querySelector('.bottom-cta .btn-primary');
      const tunnelUrl = window.location.href.split('?')[0]; 
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=svg&margin=0&color=0a0a0a&bgcolor=e5e5e7&data=${encodeURIComponent(tunnelUrl)}`;
      
      button.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 12px 0;">
           <img src="${qrApiUrl}" alt="QR Code" style="width: 140px; height: 140px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
           <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Scan to view in AR</span>
        </div>
      `;
      button.style.height = 'auto';
      button.style.background = 'transparent';
      button.style.boxShadow = 'none';
      button.style.pointerEvents = 'none'; // Disable further clicks
    }
  };

  // ───────────────────────────────────────────────────────────────
  // IMAGE TRACKER (OPEN-SOURCE A-FRAME / MINDAR ENGINE)
  // ───────────────────────────────────────────────────────────────
  window.launchImageTracker = function() {
    const overlay = document.getElementById('mindar-overlay');
    overlay.style.display = 'block';
    
    // Inject A-Frame dynamically so it doesn't break the CSS scroll snaps on page load
    const container = document.getElementById('mindar-scene-container');
    container.innerHTML = `
      <a-scene mindar-image="imageTargetSrc: assets/target.mind; autoStart: true; uiScanning: yes;" color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
        <a-entity mindar-image-target="targetIndex: 0">
          <!-- CENTER: Magic Spell Bottle -->
          <a-gltf-model src="assets/bottle.glb" position="0 0 0.1" scale="0.6 0.6 0.6" rotation="0 0 0" animation="property: rotation; to: 0 360 0; loop: true; dur: 4500; easing: linear;"></a-gltf-model>
          
          <!-- Holographic Floating System Labels -->
          <a-text value="MAGIC SPELL" position="0 0.7 0.1" color="#E89B7F" scale="0.8 0.8 0.8" font="kelsonsans" align="center"></a-text>
        </a-entity>
      </a-scene>
    `;
  };

  window.closeImageTracker = function() {
    const overlay = document.getElementById('mindar-overlay');
    overlay.style.display = 'none';
    const container = document.getElementById('mindar-scene-container');
    container.innerHTML = ''; // Kill AR Session + clear camera feed completely safely
  };

  const debug = {
    lines: [],
    add(type, msg) {
      const time = new Date().toLocaleTimeString();
      const line = `${time} · ${type} · ${msg}`;
      this.lines.push(line);
      if (this.lines.length > 80) this.lines.shift();
      const pre = document.getElementById('debug-log');
      if (pre) pre.textContent = this.lines.join('\n');
      if (type === 'ERR') {
        const btn = document.getElementById('debug-toggle');
        if (btn) btn.classList.add('has-errors');
      }
    },
    log(...a)  { this.add('LOG', a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')); },
    warn(...a) { this.add('WRN', a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')); },
    error(...a){ this.add('ERR', a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')); }
  };

  window.addEventListener('error', (e) => {
    debug.error(`${e.message} @ ${e.filename}:${e.lineno}`);
    track('js_error', { message: e.message, file: e.filename, line: e.lineno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    debug.error(`Unhandled promise: ${e.reason?.message || e.reason}`);
    track('unhandled_rejection', { reason: String(e.reason) });
  });

  // ───────────────────────────────────────────────────────────────
  // MODEL VIEWER — self-hosted Draco decoder (critical for mobile)
  // ───────────────────────────────────────────────────────────────
  function configureModelViewer() {
    const tryConfigure = () => {
      const mvClass = customElements.get('model-viewer');
      if (!mvClass) { setTimeout(tryConfigure, 100); return; }
      mvClass.dracoDecoderLocation = 'assets/draco/';
      debug.log('Draco decoder → assets/draco/');
    };
    tryConfigure();
  }

  function wireModelViewerEvents() {
    $$('model-viewer').forEach((mv) => {
      mv.addEventListener('load', () => {
        if (mv.id === 'chair-model') {
          applyChairMatteBlackMaterialWithRetry(mv);
        }
        track('model_loaded', { id: mv.id });
        debug.log(`Model loaded · ${mv.id}`);
      });
      mv.addEventListener('error', (e) => {
        const detail = e.detail?.sourceError?.message || e.detail?.type || 'unknown';
        console.error('[model-viewer] error', mv.id, e);
        debug.error(`Model FAILED · ${mv.id} · ${detail}`);
        track('model_error', { id: mv.id, detail });
      });
      mv.addEventListener('ar-status', (e) => {
        track('ar_status', { id: mv.id, status: e.detail.status });
        debug.log(`AR · ${mv.id} · ${e.detail.status}`);
      });
    });
  }

  function applyChairMatteBlackMaterialWithRetry(modelViewerEl, attempt = 0) {
    const materials = modelViewerEl?.model?.materials || [];
    if (!materials.length) {
      if (attempt < 20) {
        setTimeout(() => applyChairMatteBlackMaterialWithRetry(modelViewerEl, attempt + 1), 120);
      } else {
        debug.warn('Chair materials unavailable for matte-black override');
        track('chair_material_matte_black_failed', { reason: 'materials_unavailable' });
      }
      return;
    }
    applyChairMatteBlackMaterial(modelViewerEl);
  }

  function applyChairMatteBlackMaterial(modelViewerEl) {
    const materials = modelViewerEl?.model?.materials || [];

    materials.forEach((material) => {
      const pbr = material?.pbrMetallicRoughness;
      if (!pbr) return;

      // Compromise: Since the chair is a single mesh, we apply a global dark, semi-reflective finish.
      // We keep the texture (if any) but darken it heavily, and add a slight metallic sheen.
      pbr.setBaseColorFactor([0.2, 0.2, 0.2, 1]); // Darken existing texture
      pbr.setMetallicFactor(0.4); // Add some metallic reflection
      pbr.setRoughnessFactor(0.5); // Lower roughness to catch light
      
      // Removed the code that strips out the texture so it retains its detail

    });

    modelViewerEl.setAttribute('exposure', '1.0');
    track('chair_material_matte_black_applied', { materials: materials.length });
    debug.log(`Chair matte black applied · ${materials.length} materials`);
  }

  // ───────────────────────────────────────────────────────────────
  // SCREEN ROUTER
  // ───────────────────────────────────────────────────────────────
  function showScreen(n) {
    n = Math.max(1, Math.min(TOTAL_SCREENS, n));
    const prev = currentScreen;
    currentScreen = n;

    $$('.screen').forEach((el) => {
      el.classList.toggle('active', parseInt(el.dataset.screen, 10) === n);
    });

    $('#btn-restart').classList.toggle('visible', n >= 2);

    track('screen_view', { screen: n, from: prev });
    debug.log(`Screen · ${prev} → ${n}`);

    if (navigator.vibrate) navigator.vibrate(6);
    // Scroll new screen to top of viewport
    const active = $('.screen.active');
    if (active) active.scrollTop = 0;

    if (n === 1) {
      playIntroMotion();
    }
  }

  function nextScreen() {
    if (currentScreen < TOTAL_SCREENS) showScreen(currentScreen + 1);
  }

  function restart() {
    track('experience_restart');
    const input = $('#contact-input');
    if (input) input.value = '';
    const feedback = $('#form-feedback');
    if (feedback) feedback.textContent = '';
    showScreen(1);
  }

  function playIntroMotion() {
    console.log('[🎬 INTRO] playIntroMotion called · anime?', typeof anime);
    const introScreen = document.querySelector('.screen[data-screen="1"]');
    if (!introScreen) { console.warn('[🎬 INTRO] screen1 missing'); return; }

    const bottle    = introScreen.querySelector('.intro-product');
    const ring      = introScreen.querySelector('.intro-impact-ring');
    const aurora    = introScreen.querySelector('.aurora-bloom');
    const auroraLayers = aurora?.querySelectorAll('.aurora-layer');
    const eyebrow   = introScreen.querySelector('.eyebrow');
    const headline  = introScreen.querySelector('.hero-headline');
    const sub       = introScreen.querySelector('.hero-sub');
    const ctaBtn    = introScreen.querySelector('.bottom-cta button');
    const stepLabel = introScreen.querySelector('.bottom-cta .step-label');

    if (typeof anime === 'undefined') {
      debug.warn('anime.js not loaded — intro motion skipped');
      // Fallback: just show everything
      if (bottle)   bottle.style.transform = 'translate(-50%, 12px)';
      if (bottle)   bottle.style.opacity = '1';
      if (aurora)   aurora.style.opacity = '0.55';
      introScreen.querySelectorAll('.hero-stack, .bottom-cta > *').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    introScreen.classList.remove('intro-done');
    aurora?.classList.remove('ambient');

    // Pixel values — compute from viewport so the bottle starts well above the fold
    const DROP_START_Y = -(window.innerHeight + 200);
    const DROP_END_Y   = 12;

    // ───────────────────────────────
    // Reset initial states (anime.set — bottle is now inside a wrapper that
    // handles X centering, so anime only touches Y, scale, rotate, opacity)
    // ───────────────────────────────
    anime.set(bottle, {
      opacity: 0,
      translateY: DROP_START_Y,
      scale: 0.9,
      rotate: -4
    });

    anime.set(ring, {
      opacity: 0,
      translateX: '-50%',
      scale: 0.2
    });

    anime.set(aurora, { opacity: 0 });
    anime.set(auroraLayers, {
      translateX: '-50%',
      translateY: 30,
      scale: 0.15
    });

    anime.set([eyebrow, headline, sub, ctaBtn, stepLabel].filter(Boolean), {
      opacity: 0,
      translateY: 28
    });

    // ───────────────────────────────
    // Timeline
    // ───────────────────────────────
    const tl = anime.timeline({
      complete: () => {
        introScreen.classList.add('intro-done');
        aurora?.classList.add('ambient');
        debug.log('Intro motion complete');
      }
    });

    // ═════════ PHASE 1 — Bottle falls from above (950ms) ═════════
    // Heavy ease-out so the bottle accelerates into the landing
    tl.add({
      targets: bottle,
      opacity: [0, 1],
      translateY: [DROP_START_Y, DROP_END_Y],
      rotate: [-4, 0],
      scale: [0.92, 1],
      duration: 950,
      easing: 'cubicBezier(0.35, 0.0, 0.25, 1)'
    });

    // ═════════ PHASE 2 — IMPACT (all simultaneous at landing) ═════════
    // Everything below starts at the SAME moment: when the bottle hits ground.
    // That means aurora FLASHES in, screen SHAKES, haptic fires, all in sync.

    // 2a: Aurora opacity — INSTANT snap to full brightness (40ms flash)
    tl.add({
      targets: aurora,
      opacity: [0, 1],
      duration: 40,
      easing: 'linear',
      begin: () => {
        // Haptic vibration fires exactly at impact
        if (navigator.vibrate) navigator.vibrate([25, 20, 15, 12]);
        debug.log('💥 IMPACT · haptic + aurora snap');
      }
    }, '-=0'); // Starts the moment the drop ends

    // 2b: Aurora layers burst outward (fast expansion from impact point)
    tl.add({
      targets: auroraLayers,
      scale: [0.1, 1.15],
      translateY: [40, 0],
      duration: 420,
      delay: anime.stagger(30),
      easing: 'cubicBezier(0.08, 0.82, 0.3, 1)' // fast out, soft settle
    }, '-=40'); // overlap with the flash

    // 2c: Bottle squash bounce (lands, compresses, rebounds)
    tl.add({
      targets: bottle,
      translateY: [12, 3, 15, 10],
      scale: [1, 1.04, 0.98, 1],
      duration: 340,
      easing: 'easeOutQuad'
    }, '-=420');

    // 2d: Screen shake (parallel with bottle squash)
    tl.add({
      targets: introScreen,
      translateX: [0, -14, 10, -6, 3, 0],
      duration: 420,
      easing: 'easeOutQuad'
    }, '-=340');

    // 2e: Impact ring — ripples outward from landing point
    tl.add({
      targets: ring,
      opacity: [0, 1, 0],
      scale: [0.2, 9],
      duration: 700,
      easing: 'cubicBezier(0.15, 0.75, 0.25, 1)'
    }, '-=420');

    // 2f: Aurora layers relax back (slightly shrink to final size)
    tl.add({
      targets: auroraLayers,
      scale: [1.15, 1],
      duration: 340,
      delay: anime.stagger(30),
      easing: 'easeOutQuad'
    }, '-=220');

    // ═════════ PHASE 3 — Text cascades in (after impact settles) ═════════
    // Aurora dims slightly while text appears
    tl.add({
      targets: aurora,
      opacity: [1, 0.55],
      duration: 540,
      easing: 'easeOutQuad'
    }, '-=180');

    tl.add({
      targets: [eyebrow, headline, sub].filter(Boolean),
      opacity: [0, 1],
      translateY: [28, 0],
      duration: 680,
      delay: anime.stagger(110),
      easing: 'cubicBezier(0.2, 0.8, 0.25, 1)'
    }, '-=540');

    tl.add({
      targets: [ctaBtn, stepLabel].filter(Boolean),
      opacity: [0, 1],
      translateY: [28, 0],
      duration: 620,
      delay: anime.stagger(90),
      easing: 'cubicBezier(0.2, 0.8, 0.25, 1)'
    }, '-=280');

    track('intro_motion_played');
  }

  function runBrandIntro() {
    const intro = $('#brand-intro');
    if (!intro) {
      document.body.classList.add('app-ready');
      showScreen(1);
      return;
    }

    // Phase A: Brand intro visible (1300ms)
    setTimeout(() => {
      // Phase B: Start fade-out (CSS transition ~420ms)
      intro.classList.add('hidden');

      // Phase C: Wait for fade to complete AND for bottle model to be ready
      const bottleEl = document.querySelector('#intro-product-model');
      const modelReady = new Promise((resolve) => {
        if (bottleEl?.loaded) return resolve();
        const timeout = setTimeout(resolve, 2000); // hard cap
        bottleEl?.addEventListener('load', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
      const fadeDone = new Promise((resolve) => setTimeout(resolve, 480));

      Promise.all([modelReady, fadeDone]).then(() => {
        document.body.classList.add('app-ready');
        showScreen(1);
      });
    }, 1300);
  }

  // ───────────────────────────────────────────────────────────────
  // EMAIL CAPTURE
  // ───────────────────────────────────────────────────────────────
  function validateContact(value) {
    const v = value.trim();
    if (!v) return { ok: false, reason: 'ENTER AN EMAIL OR PHONE' };
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRe = /^[\d\s\-+()]{7,}$/;
    if (emailRe.test(v)) return { ok: true, type: 'email', value: v };
    if (phoneRe.test(v)) return { ok: true, type: 'phone', value: v };
    return { ok: false, reason: 'INVALID FORMAT' };
  }

  function handleContactSubmit() {
    const input = $('#contact-input');
    const feedback = $('#form-feedback');
    const result = validateContact(input.value);

    if (!result.ok) {
      feedback.textContent = result.reason;
      feedback.style.color = '#ff5d5d';
      track('contact_invalid', { reason: result.reason });
      return;
    }

    try {
      const saved = JSON.parse(localStorage.getItem('curlcult_contacts') || '[]');
      saved.push({ type: result.type, value: result.value, ts: Date.now() });
      localStorage.setItem('curlcult_contacts', JSON.stringify(saved));
    } catch (_) {}

    feedback.textContent = '✓  LINK ON THE WAY';
    feedback.style.color = '#E89B7F';
    input.value = '';
    track('contact_captured', { type: result.type });
  }

  // ───────────────────────────────────────────────────────────────
  // EVENT WIRING
  // ───────────────────────────────────────────────────────────────
  function wireEvents() {
    // Global click delegation for next/restart
    document.addEventListener('click', (e) => {
      const next = e.target.closest('[data-next]');
      if (next) {
        e.preventDefault();
        nextScreen();
      }
      const restartBtn = e.target.closest('[data-restart]');
      if (restartBtn) {
        e.preventDefault();
        restart();
      }
    });

    $('#btn-restart').addEventListener('click', restart);

    // Join form submit
    $('#join-form').addEventListener('submit', (e) => {
      e.preventDefault();
      handleContactSubmit();
    });
    $('#contact-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleContactSubmit();
      }
    });

    // Debug console
    $('#debug-toggle').addEventListener('click', () => {
      $('#debug-console').classList.toggle('visible');
      $('#debug-toggle').classList.remove('has-errors');
    });
    $('#debug-close').addEventListener('click', () => {
      $('#debug-console').classList.remove('visible');
    });

    // Desktop keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextScreen();
      }
      if (e.key === 'ArrowLeft' && currentScreen > 1) {
        e.preventDefault();
        showScreen(currentScreen - 1);
      }
      if (e.key === 'r') restart();
    });
  }

  // ───────────────────────────────────────────────────────────────
  // BOOT — straight into Screen 1, no gate, no scan
  // ───────────────────────────────────────────────────────────────
  function init() {
    configureModelViewer();
    wireEvents();
    wireModelViewerEvents();

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      const desktopBtn = document.querySelector('#desktop-qr-btn');
      if (desktopBtn) desktopBtn.style.display = 'flex';
    }

    $('#debug-toggle')?.classList.add('visible');

    debug.log(`Boot · ${navigator.userAgent.substring(0, 60)}`);
    debug.log(`Viewport · ${window.innerWidth}×${window.innerHeight}`);
    debug.log(`Secure context · ${window.isSecureContext} · ${location.protocol}`);

    track('experience_start', {
      ua: navigator.userAgent.substring(0, 100),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      secure: window.isSecureContext,
      protocol: location.protocol
    });

    runBrandIntro();

    console.log('%cCURL CULT · AR Experience', 'font: 600 14px Geist; color: #f5f5f7; letter-spacing: 0.1em');
    console.log('%cKeyboard: → next · ← back · r restart', 'color: #86868b');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
