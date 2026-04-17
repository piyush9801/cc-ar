/* ═══════════════════════════════════════════════════════════════════
   CURL CULT · AR EXPERIENCE APP.JS
   8-screen state machine · no scan · no gate · direct entry
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const TOTAL_SCREENS = 8;

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT CATALOG — drives the dynamic detail page (screen 6)
  // ═══════════════════════════════════════════════════════════════
  const PRODUCTS = [
    {
      id: 'magic-spell',
      index: 'Product 01',
      name: 'Magic Spell.',
      tagline: 'Prep. Protect. Performance.',
      model: 'assets/bottle-opt.glb',
      cameraOrbit: '-15deg 85deg 2.4m',
      scanCta: 'Summon the full system',
      specs: [
        ['Format',    '250 mL · 8.45 fl. oz.'],
        ['Purpose',   'Conditioning leave-in'],
        ['Works on',  'All curl patterns']
      ]
    },
    {
      id: 'conditioner',
      index: 'Product 02',
      name: 'Hydrating Conditioner.',
      tagline: 'Weightless hydration. Deep repair.',
      model: 'assets/conditioner.glb',
      cameraOrbit: '-10deg 85deg 2.6m',
      scanCta: 'Summon the full system',
      specs: [
        ['Format',    '240 mL · 8.11 fl. oz.'],
        ['Purpose',   'Rinse-out conditioner'],
        ['Works on',  'All hair types']
      ]
    },
    {
      id: 'curl-cream',
      index: 'Product 03',
      name: 'Curl Cream.',
      tagline: 'Definition without the crunch.',
      model: 'assets/cream.glb',
      cameraOrbit: '-10deg 85deg 2.6m',
      scanCta: 'Summon the full system',
      specs: [
        ['Format',    '200 mL · 6.76 fl. oz.'],
        ['Purpose',   'Leave-in styling cream'],
        ['Works on',  'Wavy · Curly · Coily']
      ]
    }
  ];

  let currentProductIndex = 0;
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

  // ═══════════════════════════════════════════════════════════════
  // GRAND AR: MINDAR FLYER CONSTELLATION
  // When user scans the Curl Cult flyer, the full product system
  // materializes above it as a choreographed constellation with
  // staggered product drops, holographic text, and ambient particles.
  // ═══════════════════════════════════════════════════════════════
  window.launchImageTracker = function() {
    const overlay = document.getElementById('mindar-overlay');
    overlay.style.display = 'block';
    track('ar_flyer_launch');

    const container = document.getElementById('mindar-scene-container');

    // Three products arranged in triangle formation above the flyer.
    // Coordinates are in MindAR target space where 1 unit ≈ image width.
    // Y = vertical lift, Z = depth toward camera, X = horizontal spread.
    container.innerHTML = `
      <a-scene
        mindar-image="imageTargetSrc: assets/target.mind; autoStart: true; uiScanning: yes; uiLoading: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.001"
        color-space="sRGB"
        renderer="colorManagement: true, physicallyCorrectLights: true, antialias: true, alpha: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false">

        <a-assets>
          <a-asset-item id="ar-bottle"      src="assets/bottle-opt.glb"></a-asset-item>
          <a-asset-item id="ar-conditioner" src="assets/conditioner.glb"></a-asset-item>
          <a-asset-item id="ar-cream"       src="assets/cream.glb"></a-asset-item>
        </a-assets>

        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

        <!-- Ambient lighting for PBR glow -->
        <a-entity light="type: ambient; intensity: 0.55; color: #fff"></a-entity>
        <a-entity light="type: directional; intensity: 0.9; color: #fff" position="0.3 1 0.8"></a-entity>
        <a-entity light="type: point; color: #E89B7F; intensity: 1.2; distance: 2" position="0 0.4 0.3"></a-entity>

        <a-entity mindar-image-target="targetIndex: 0">

          <!-- ── Baseplate rim: glowing accent circle under the lineup ── -->
          <a-ring
            color="#E89B7F"
            radius-inner="0.38"
            radius-outer="0.41"
            position="0 0 0.01"
            rotation="-90 0 0"
            material="opacity: 0.7; transparent: true; shader: flat"
            animation="property: rotation; to: -90 0 360; loop: true; dur: 12000; easing: linear">
          </a-ring>

          <a-ring
            color="#E89B7F"
            radius-inner="0.48"
            radius-outer="0.49"
            position="0 0 0.005"
            rotation="-90 0 0"
            material="opacity: 0.3; transparent: true; shader: flat"
            animation="property: rotation; to: -90 0 -360; loop: true; dur: 24000; easing: linear">
          </a-ring>

          <!-- ── CENTER: Magic Spell (hero, elevated) ── -->
          <a-gltf-model
            src="#ar-bottle"
            position="0 -0.2 0.05"
            scale="0.001 0.001 0.001"
            rotation="0 0 0"
            animation__scalein="property: scale; from: 0.001 0.001 0.001; to: 0.28 0.28 0.28; dur: 900; delay: 300; easing: easeOutBack"
            animation__lift="property: position; from: 0 -0.2 0.05; to: 0 0.1 0.15; dur: 900; delay: 300; easing: easeOutBack"
            animation__spin="property: rotation; to: 0 360 0; loop: true; dur: 6000; easing: linear; startEvents: animationcomplete__scalein">
          </a-gltf-model>

          <!-- ── LEFT: Conditioner ── -->
          <a-gltf-model
            src="#ar-conditioner"
            position="-0.5 -0.2 0"
            scale="0.001 0.001 0.001"
            rotation="0 20 0"
            animation__scalein="property: scale; from: 0.001 0.001 0.001; to: 0.22 0.22 0.22; dur: 800; delay: 700; easing: easeOutBack"
            animation__lift="property: position; from: -0.5 -0.2 0; to: -0.5 0.05 0.08; dur: 800; delay: 700; easing: easeOutBack"
            animation__spin="property: rotation; from: 0 20 0; to: 0 380 0; loop: true; dur: 7000; easing: linear; startEvents: animationcomplete__scalein">
          </a-gltf-model>

          <!-- ── RIGHT: Curl Cream ── -->
          <a-gltf-model
            src="#ar-cream"
            position="0.5 -0.2 0"
            scale="0.001 0.001 0.001"
            rotation="0 -20 0"
            animation__scalein="property: scale; from: 0.001 0.001 0.001; to: 0.22 0.22 0.22; dur: 800; delay: 1100; easing: easeOutBack"
            animation__lift="property: position; from: 0.5 -0.2 0; to: 0.5 0.05 0.08; dur: 800; delay: 1100; easing: easeOutBack"
            animation__spin="property: rotation; from: 0 -20 0; to: 0 340 0; loop: true; dur: 7000; easing: linear; startEvents: animationcomplete__scalein">
          </a-gltf-model>

          <!-- ── EXPLODED VIEW DETAILS (Holographic Annotations) ── -->
          
          <!-- PISIM PROTECT (Left Mid) -->
          <a-entity position="-0.45 0.25 0.1" scale="0 0 0"
            animation__in="property: scale; from: 0 0 0; to: 1 1 1; dur: 800; delay: 2800; easing: easeOutElastic"
            animation__float="property: position; to: -0.45 0.27 0.1; dir: alternate; loop: true; dur: 2000; easing: easeInOutSine; startEvents: animationcomplete__in">
            <a-text value="PISIM PROTECT" color="#E89B7F" font="mozillavr" scale="0.25 0.25 0.25" align="right" position="-0.06 0 0"></a-text>
            <a-text value="Universal Compatibility" color="#f5f5f7" font="mozillavr" scale="0.12 0.12 0.12" align="right" position="-0.06 -0.06 0"></a-text>
            <a-circle color="#E89B7F" radius="0.012" position="-0.02 0 0" material="shader: flat"></a-circle>
            <!-- Line connecting to bottle center -->
            <a-entity line="start: -0.02 0 0; end: 0.45 -0.15 0.05; color: #E89B7F; opacity: 0.5"></a-entity>
          </a-entity>

          <!-- HYDROLYZED KERATIN (Right Low) -->
          <a-entity position="0.45 0.05 0.1" scale="0 0 0"
            animation__in="property: scale; from: 0 0 0; to: 1 1 1; dur: 800; delay: 3000; easing: easeOutElastic"
            animation__float="property: position; to: 0.45 0.07 0.1; dir: alternate; loop: true; dur: 2200; easing: easeInOutSine; startEvents: animationcomplete__in">
            <a-text value="HYDROLYZED KERATIN" color="#E89B7F" font="mozillavr" scale="0.25 0.25 0.25" align="left" position="0.06 0 0"></a-text>
            <a-text value="Deep Internal Repair" color="#f5f5f7" font="mozillavr" scale="0.12 0.12 0.12" align="left" position="0.06 -0.06 0"></a-text>
            <a-circle color="#E89B7F" radius="0.012" position="0.02 0 0" material="shader: flat"></a-circle>
            <!-- Line connecting to bottle base -->
            <a-entity line="start: 0.02 0 0; end: -0.45 0.05 0.05; color: #E89B7F; opacity: 0.5"></a-entity>
          </a-entity>

          <!-- ARGAN OIL (Right High) -->
          <a-entity position="0.4 0.35 0.1" scale="0 0 0"
            animation__in="property: scale; from: 0 0 0; to: 1 1 1; dur: 800; delay: 3200; easing: easeOutElastic"
            animation__float="property: position; to: 0.4 0.37 0.1; dir: alternate; loop: true; dur: 1900; easing: easeInOutSine; startEvents: animationcomplete__in">
            <a-text value="ARGAN OIL" color="#E89B7F" font="mozillavr" scale="0.25 0.25 0.25" align="left" position="0.06 0 0"></a-text>
            <a-text value="Weightless Hydration" color="#f5f5f7" font="mozillavr" scale="0.12 0.12 0.12" align="left" position="0.06 -0.06 0"></a-text>
            <a-circle color="#E89B7F" radius="0.012" position="0.02 0 0" material="shader: flat"></a-circle>
            <!-- Line connecting to bottle cap -->
            <a-entity line="start: 0.02 0 0; end: -0.4 -0.25 0.05; color: #E89B7F; opacity: 0.5"></a-entity>
          </a-entity>

          <!-- ── MAGIC PARTICLES (Rising from the cap) ── -->
          <a-entity position="0 0.25 0.15">
             <a-sphere radius="0.006" color="#E89B7F" material="shader: flat; transparent: true; opacity: 0"
               animation="property: position; from: 0 0 0; to: -0.05 0.25 0; loop: true; dur: 2400; easing: easeOutSine"
               animation__fade="property: material.opacity; from: 0.9; to: 0; loop: true; dur: 2400; easing: easeOutSine"></a-sphere>
             <a-sphere radius="0.004" color="#f5f5f7" material="shader: flat; transparent: true; opacity: 0"
               animation="property: position; from: 0 0 0; to: 0.04 0.3 0.03; loop: true; dur: 2800; delay: 800; easing: easeOutSine"
               animation__fade="property: material.opacity; from: 0.9; to: 0; loop: true; dur: 2800; delay: 800; easing: easeOutSine"></a-sphere>
             <a-sphere radius="0.005" color="#E89B7F" material="shader: flat; transparent: true; opacity: 0"
               animation="property: position; from: 0 0 0; to: 0.01 0.35 -0.02; loop: true; dur: 2200; delay: 1500; easing: easeOutSine"
               animation__fade="property: material.opacity; from: 0.9; to: 0; loop: true; dur: 2200; delay: 1500; easing: easeOutSine"></a-sphere>
          </a-entity>

          <!-- ── TOP: System headline (holographic) ── -->
          <a-text
            value="THE MODERN SYSTEM"
            position="0 0.55 0.15"
            align="center"
            color="#E89B7F"
            scale="0 0 0"
            width="2.2"
            font="mozillavr"
            animation__in="property: scale; from: 0 0 0; to: 0.6 0.6 0.6; dur: 700; delay: 1500; easing: easeOutExpo"
            animation__float="property: position; to: 0 0.58 0.15; dir: alternate; loop: true; dur: 2400; easing: easeInOutSine; startEvents: animationcomplete__in">
          </a-text>

          <a-text
            value="CURL CULT"
            position="0 0.42 0.15"
            align="center"
            color="#f5f5f7"
            scale="0 0 0"
            width="3.6"
            font="mozillavr"
            animation__in="property: scale; from: 0 0 0; to: 1 1 1; dur: 600; delay: 1700; easing: easeOutExpo">
          </a-text>

          <!-- ── BOTTOM: Product counter ── -->
          <a-text
            value="01 / 03     02 / 03     03 / 03"
            position="0 -0.42 0.1"
            align="center"
            color="#E89B7F"
            scale="0 0 0"
            width="1.8"
            font="mozillavr"
            opacity="0.7"
            animation__in="property: scale; from: 0 0 0; to: 0.35 0.35 0.35; dur: 500; delay: 2100; easing: easeOutExpo">
          </a-text>

          <!-- ── Corner accent ticks (editorial framing marks) ── -->
          <a-entity position="-0.48 0.3 0.02">
            <a-plane color="#E89B7F" width="0.08" height="0.002" position="0 0 0" material="shader: flat; transparent: true; opacity: 0"
              animation="property: material.opacity; from: 0; to: 0.9; dur: 400; delay: 2200"></a-plane>
            <a-plane color="#E89B7F" width="0.002" height="0.08" position="0 -0.04 0" material="shader: flat; transparent: true; opacity: 0"
              animation="property: material.opacity; from: 0; to: 0.9; dur: 400; delay: 2300"></a-plane>
          </a-entity>
          <a-entity position="0.48 0.3 0.02">
            <a-plane color="#E89B7F" width="0.08" height="0.002" position="0 0 0" material="shader: flat; transparent: true; opacity: 0"
              animation="property: material.opacity; from: 0; to: 0.9; dur: 400; delay: 2200"></a-plane>
            <a-plane color="#E89B7F" width="0.002" height="0.08" position="0 -0.04 0" material="shader: flat; transparent: true; opacity: 0"
              animation="property: material.opacity; from: 0; to: 0.9; dur: 400; delay: 2300"></a-plane>
          </a-entity>

        </a-entity>
      </a-scene>

      <!-- Editorial HUD overlay (outside a-scene, HTML) -->
      <div id="ar-hud">
        <div class="ar-hud-top">
          <span class="ar-hud-brand">CURL CULT</span>
          <span class="ar-hud-mode">⏣ LIVE AR</span>
        </div>
        <div class="ar-hud-hint" id="ar-hud-hint">Point at your Curl Cult flyer</div>
        <div class="ar-hud-bottom">
          <span class="ar-hud-tag">The Modern System</span>
          <span class="ar-hud-ticks">— — —</span>
        </div>
      </div>
    `;

    // Wire up target found/lost for HUD + haptic feedback
    requestAnimationFrame(() => {
      const target = container.querySelector('[mindar-image-target]');
      const hint   = document.getElementById('ar-hud-hint');
      if (target) {
        target.addEventListener('targetFound', () => {
          if (hint) { hint.textContent = 'The Modern System'; hint.classList.add('found'); }
          if (navigator.vibrate) navigator.vibrate([12, 40, 8, 40, 24]);
          track('ar_flyer_target_found');
          debug.log('AR · flyer target acquired');
        });
        target.addEventListener('targetLost', () => {
          if (hint) { hint.textContent = 'Point at your Curl Cult flyer'; hint.classList.remove('found'); }
          track('ar_flyer_target_lost');
          debug.log('AR · flyer target lost');
        });
      }
    });
  };

  window.closeImageTracker = function() {
    const overlay = document.getElementById('mindar-overlay');
    overlay.style.display = 'none';
    const container = document.getElementById('mindar-scene-container');
    container.innerHTML = ''; // Kill AR session + free camera
    track('ar_flyer_close');
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
        // Any model-viewer flagged [data-clean-label] gets its texture stripped
        // and replaced with a clean cream PBR finish — kills Tripo label artifacts
        if (mv.hasAttribute('data-clean-label')) {
          applyCleanLabelMaterialWithRetry(mv);
        }
        track('model_loaded', { id: mv.id || mv.getAttribute('src') });
        debug.log(`Model loaded · ${mv.id || mv.getAttribute('src')}`);
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

  // ─── Bottle finish swap via 8th Wall-style color swatches ───
  // Converts hex → [r,g,b,1] and applies PBR factors to the screen 6 bottle.
  function applyBottleFinish(hex, roughness, metallic) {
    const mv = $('#bottle-detail');
    if (!mv || !mv.model) {
      debug.warn('bottle finish: model not ready');
      return;
    }
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const materials = mv.model.materials || [];
    materials.forEach((material) => {
      const pbr = material?.pbrMetallicRoughness;
      if (!pbr) return;
      try {
        pbr.setBaseColorFactor([r, g, b, 1]);
        pbr.setRoughnessFactor(roughness);
        pbr.setMetallicFactor(metallic);
      } catch (_) {}
    });
    debug.log(`Bottle finish · ${hex} · rough ${roughness} · metal ${metallic}`);
  }

  function applyCleanLabelMaterialWithRetry(mvEl, attempt = 0) {
    const materials = mvEl?.model?.materials || [];
    if (!materials.length) {
      if (attempt < 20) {
        setTimeout(() => applyCleanLabelMaterialWithRetry(mvEl, attempt + 1), 120);
      }
      return;
    }
    applyCleanLabelMaterial(mvEl);
  }

  function applyCleanLabelMaterial(mvEl) {
    const materials = mvEl?.model?.materials || [];
    // Strategy: read the existing baseColorFactor (not the texture itself).
    // Dark materials (caps/triggers) keep their character but get slight desaturation.
    // Bright materials (bottle bodies) get tinted warm-cream by multiplying the factor,
    // which blends with the underlying texture — hiding Tripo label artifacts while
    // preserving bottle silhouette + shading. We never null the texture (that broke models).
    materials.forEach((material) => {
      const pbr = material?.pbrMetallicRoughness;
      if (!pbr) return;
      try {
        const cur = pbr.baseColorFactor || [1, 1, 1, 1];
        const brightness = (cur[0] + cur[1] + cur[2]) / 3;
        if (brightness > 0.35) {
          // Body / label area — tint warm bone/tan so the bottle reads against
          // the white polaroid card. Washes Tripo label text but keeps silhouette.
          pbr.setBaseColorFactor([0.78, 0.72, 0.60, 1]);
          pbr.setRoughnessFactor(0.6);
          pbr.setMetallicFactor(0.04);
        } else {
          // Dark plastic (cap, trigger) — leave almost alone, just slightly desaturate
          const g = (cur[0] + cur[1] + cur[2]) / 3;
          pbr.setBaseColorFactor([g * 0.9, g * 0.9, g * 0.95, 1]);
          pbr.setRoughnessFactor(0.5);
          pbr.setMetallicFactor(0.15);
        }
      } catch (e) {
        debug.warn(`clean-label material skipped: ${e.message}`);
      }
    });
    debug.log(`Clean-label applied · ${materials.length} mats · ${mvEl.getAttribute('src')}`);
  }

  function applyChairMatteBlackMaterial(modelViewerEl) {
    const materials = modelViewerEl?.model?.materials || [];

    materials.forEach((material) => {
      const pbr = material?.pbrMetallicRoughness;
      if (!pbr) return;

      // True matte-black leather — verified in preview.
      // Key: removeAttribute('environment-image') disables IBL, then
      // exposure 0.6 + factor [0.05, 0.05, 0.06] + roughness 0.9
      // yields proper charcoal against the dark stage.
      try {
        if (pbr.baseColorTexture && pbr.baseColorTexture.setTexture) {
          pbr.baseColorTexture.setTexture(null);
        }
      } catch (_) { /* noop */ }
      pbr.setBaseColorFactor([0.05, 0.05, 0.06, 1]);
      pbr.setMetallicFactor(0.0);
      pbr.setRoughnessFactor(0.9);

      try { material.setEmissiveFactor && material.setEmissiveFactor([0, 0, 0]); } catch (_) {}
    });

    // CRITICAL: no IBL env image, low exposure, strong shadows
    modelViewerEl.removeAttribute('environment-image');
    modelViewerEl.setAttribute('exposure', '0.6');
    modelViewerEl.setAttribute('shadow-intensity', '1.4');
    track('chair_material_matte_black_applied', { materials: materials.length });
    debug.log(`Chair matte black applied · ${materials.length} materials`);

    // Position the hotspots dynamically by reading the chair's world bbox.
    // The GLB's local coordinate system is unknown (different Tripo models
    // have different origins), so we compute the bbox at load time and
    // place hotspots at fractions of the bbox.
    positionChairHotspots(modelViewerEl);
  }

  function positionChairHotspots(mv) {
    try {
      const scene = mv.model?.scene || mv[Object.getOwnPropertySymbols(mv).find(s => s.description === 'scene')];
      // model-viewer stores the internal three.js scene in its symbolic `scene` getter
      const sym = Object.getOwnPropertySymbols(mv).find(s => String(s).includes('scene'));
      const three = sym ? mv[sym] : null;
      // Fallback: use the public `model.boundingBox` if available (it is, in model-viewer 4.x)
      const box = mv.getBoundingBoxCenter ? null : null;

      // Simpler + robust: ask model-viewer for the dimensions via its public API
      const dims = mv.getDimensions ? mv.getDimensions() : null;
      const center = mv.getBoundingBoxCenter ? mv.getBoundingBoxCenter() : null;

      if (!dims || !center) {
        debug.warn(`Chair bbox API unavailable — hotspots fallback`);
        // Fallback: hand-tuned positions that work for the Tripo chair scale
        mv.updateHotspot({ name: 'hotspot-seat', position: '0 0.55 0.25', normal: '0 1 0' });
        mv.updateHotspot({ name: 'hotspot-arm',  position: '0.4 0.4 0.25', normal: '1 0 0.3' });
        mv.updateHotspot({ name: 'hotspot-base', position: '-0.35 0.1 0.3', normal: '-1 0 0.4' });
        return;
      }

      const cx = center.x, cy = center.y, cz = center.z;
      const w = dims.x, h = dims.y, d = dims.z;

      // Push hotspots OUTSIDE the bbox on different axes so they don't overlap.
      // Seat: floats just above seat cushion (not too high or it clips viewport)
      const seatPos = `${cx.toFixed(3)} ${(cy + h * 0.35).toFixed(3)} ${(cz + d * 0.1).toFixed(3)}`;
      // Arm: floats to the RIGHT of chair (x past right edge, mid-height)
      const armPos  = `${(cx + w * 0.62).toFixed(3)} ${(cy + h * 0.05).toFixed(3)} ${(cz + d * 0.1).toFixed(3)}`;
      // Base: floats to the LOWER-LEFT (x left, y below mid)
      const basePos = `${(cx - w * 0.55).toFixed(3)} ${(cy - h * 0.38).toFixed(3)} ${(cz + d * 0.15).toFixed(3)}`;

      mv.updateHotspot({ name: 'hotspot-seat', position: seatPos, normal: '0 1 0.3' });
      mv.updateHotspot({ name: 'hotspot-arm',  position: armPos,  normal: '1 0.2 0.3' });
      mv.updateHotspot({ name: 'hotspot-base', position: basePos, normal: '-1 0 0.4' });

      debug.log(`Chair hotspots · bbox ${w.toFixed(2)}×${h.toFixed(2)}×${d.toFixed(2)}`);
      debug.log(`Hotspot seat: ${seatPos}`);
      debug.log(`Hotspot arm : ${armPos}`);
      debug.log(`Hotspot base: ${basePos}`);
    } catch (e) {
      debug.warn(`Chair hotspot positioning failed: ${e.message}`);
    }
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

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT SELECTION — wire catalog data into screen 6 DOM
  // ═══════════════════════════════════════════════════════════════
  function selectProduct(index) {
    if (!PRODUCTS.length) return;

    // Wrap index so prev/next cycle through
    if (index < 0) index = PRODUCTS.length - 1;
    if (index >= PRODUCTS.length) index = 0;

    currentProductIndex = index;
    const p = PRODUCTS[index];

    // Eyebrow, name, tagline
    const eyebrow  = $('#product-eyebrow');
    const nameEl   = $('#product-name');
    const tagline  = $('#product-tagline');
    const idxNum   = $('#product-idx-num');
    const total    = document.querySelector('.nav-total');
    const scanLbl  = $('#scan-cta-label');
    if (eyebrow) eyebrow.textContent = p.index;
    if (nameEl)  nameEl.textContent  = p.name;
    if (tagline) tagline.textContent = p.tagline;
    if (idxNum)  idxNum.textContent  = String(index + 1).padStart(2, '0');
    if (total)   total.textContent   = String(PRODUCTS.length).padStart(2, '0');
    if (scanLbl) scanLbl.textContent = p.scanCta;

    // 3D model — only swap if different (avoid re-download)
    const mv = $('#bottle-detail');
    if (mv) {
      const currentSrc = mv.getAttribute('src');
      if (currentSrc !== p.model) {
        mv.setAttribute('src', p.model);
      }
      mv.setAttribute('alt', p.name);
      if (p.cameraOrbit) mv.setAttribute('camera-orbit', p.cameraOrbit);
    }

    // Rebuild spec list
    const specs = $('#product-specs');
    if (specs) {
      specs.innerHTML = p.specs
        .map(([label, val]) => `<li><span>${label}</span><span>${val}</span></li>`)
        .join('');
    }

    track('product_selected', { id: p.id, index });
    debug.log(`Product · ${p.name} [${index + 1}/${PRODUCTS.length}]`);
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
    // Global click delegation for next/restart/product/goto
    document.addEventListener('click', (e) => {
      // Product card tapped on screen 5 → select + jump to detail
      const productCard = e.target.closest('[data-product-id]');
      if (productCard) {
        e.preventDefault();
        const id = productCard.dataset.productId;
        const index = PRODUCTS.findIndex(p => p.id === id);
        if (index >= 0) {
          selectProduct(index);
          showScreen(6);
        }
        return;
      }

      // Product prev / next arrows on screen 6
      if (e.target.closest('[data-product-prev]')) {
        e.preventDefault();
        selectProduct(currentProductIndex - 1);
        return;
      }
      if (e.target.closest('[data-product-next]')) {
        e.preventDefault();
        selectProduct(currentProductIndex + 1);
        return;
      }

      // "Back to lineup" button / any element with data-goto="N"
      const gotoBtn = e.target.closest('[data-goto]');
      if (gotoBtn) {
        e.preventDefault();
        const target = parseInt(gotoBtn.dataset.goto, 10);
        if (!isNaN(target)) showScreen(target);
        return;
      }

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

    // ─── Color swatches on screen 6 (8th Wall pattern) ───
    document.querySelectorAll('.color-swatch').forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        const el = e.currentTarget;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');

        const hex       = el.getAttribute('data-color');
        const roughness = parseFloat(el.getAttribute('data-roughness')) || 0.5;
        const metallic  = parseFloat(el.getAttribute('data-metallic')) || 0;
        const lbl       = el.getAttribute('aria-label') || '';

        applyBottleFinish(hex, roughness, metallic);
        const labelEl = $('#swatch-label');
        if (labelEl) labelEl.textContent = lbl.split(' ')[0].toUpperCase();
        if (navigator.vibrate) navigator.vibrate(8);
        track('bottle_finish_changed', { color: hex, label: lbl });
      });
    });

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

    // Populate screen 6 with the default product so it renders correctly
    // even if the user advances via the bottom CTA instead of tapping a card
    selectProduct(0);

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
