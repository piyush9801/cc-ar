/* ═══════════════════════════════════════════════════════════════════
   CURL CULT · AR-FIRST SPATIAL EXPERIENCE
   ───────────────────────────────────────────────────────────────────
   The user scans a Curl Cult product label with their phone camera.
   MindAR tracks the image in 3D space. The narrative unfolds as a
   sequence of "chapters" — each swaps both the 3D content anchored
   to the bottle AND the HTML bottom-sheet overlay.

   Architecture:
   - One persistent <a-scene mindar-image> for the full session.
   - Chapter state machine in plain JS.
   - 3D content per chapter is injected into the target entity.
   - HTML chapter content is rendered into #chapter-sheet.
   - Target-lost shows a rescan banner but preserves chapter state.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ───────────────────────────────────────────────────────────────
  // ANALYTICS + DEBUG CONSOLE (preserved from SPA build)
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

  // ═══════════════════════════════════════════════════════════════
  // REAL 3D BUTTERFLIES — loaded from assets/butterflies.glb
  // The GLB contains 12 animated butterflies + ground + ferns + flower.
  // We render it as a persistent transparent layer and hide the
  // scene-dressing (ground, ferns, flower) at runtime via PBR alpha,
  // leaving just the butterflies flying in space.
  // ═══════════════════════════════════════════════════════════════
  function butterflyStage(opts = {}) {
    const {
      cameraOrbit = '0deg 72deg 4.2m',
      exposure    = '1.4',
      pointerPassthrough = true,
    } = opts;
    // A transparent model-viewer sized to fill its parent. No camera
    // controls, no zoom, no pan, autoplay animation. data-hide-scenery
    // strips the ground/ferns/flower at load time.
    return `
      <model-viewer
        class="butterflies-mv"
        src="assets/butterflies.glb"
        data-hide-scenery="true"
        loading="eager"
        autoplay
        animation-name="Take 001"
        shadow-intensity="0"
        environment-image="neutral"
        exposure="${exposure}"
        camera-orbit="${cameraOrbit}"
        interaction-prompt="none"
        disable-zoom
        disable-pan
        disable-tap
        ${pointerPassthrough ? 'style="pointer-events:none;"' : ''}>
      </model-viewer>
    `;
  }

  // Full garden variant — keeps stones/ferns/flower visible AND hides
  // most butterflies so only 3-4 remain. Used for the opening chapter.
  function butterflyGarden(opts = {}) {
    const {
      cameraOrbit = '0deg 68deg 4.8m',
      exposure    = '1.2',
    } = opts;
    return `
      <model-viewer
        class="butterflies-mv butterflies-garden"
        src="assets/butterflies.glb"
        data-reduce-butterflies="true"
        loading="eager"
        autoplay
        animation-name="Take 001"
        shadow-intensity="0.6"
        shadow-softness="1"
        environment-image="neutral"
        exposure="${exposure}"
        camera-orbit="${cameraOrbit}"
        interaction-prompt="none"
        disable-zoom
        disable-pan
        disable-tap
        style="pointer-events:none;">
      </model-viewer>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHAPTERS — each has a stage (model-viewer) + a bottom sheet
  // Stage renders large, readable 3D. Sheet holds all typography.
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // CHAPTERS — the founder-spine narrative arc
  // Every chapter has:
  //  · founder hologram (placeholder for now → green-screen video)
  //  · a real informational payload (not decoration)
  //  · a functional AR widget where it earns its place
  // ═══════════════════════════════════════════════════════════════
  const CHAPTERS = [

    // ─── 1 · THE THRESHOLD ────────────────────────────────────
    {
      id: 'threshold',
      eyebrow: 'Welcome',
      headline: "Hi, I'm Janine.",
      body: 'For 20 years I watched clients walk out of my chair with damaged hair. This is the system I built so they don\'t.',
      cta: 'See the damage',
      founderClip: '01-threshold',
      caption: "Hi, I'm Janine. For 20 years I watched good clients walk out of my chair with damaged hair. Curl Cult is the system I built so you never have to.",
      voClip: 'assets/vo/01-threshold.mp3',
      arModel: {
        src: 'assets/janine-wave.glb',
        iosSrc: 'assets/janine-wave.usdz',
        placement: 'floor',
        label: 'Meet Janine in your space',
      },
      stage: () => `
        <div class="stage-detail stage-janine-3d">
          <model-viewer
            id="janine-mv"
            src="assets/janine-wave-matte.glb"
            ios-src="assets/janine-wave.usdz"
            loading="eager"
            reveal="auto"
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-placement="floor"
            camera-controls
            autoplay
            animation-name="Anim"
            shadow-intensity="1.35"
            shadow-softness="0.75"
            exposure="1.0"
            environment-image="neutral"
            tone-mapping="commerce"
            camera-orbit="0deg 88deg 5.4m"
            camera-target="0.04m 1.05m 0m"
            min-camera-orbit="auto 75deg auto"
            max-camera-orbit="auto 105deg auto"
            field-of-view="30deg"
            interaction-prompt="none"
            disable-zoom
            class="stage-model">
          </model-viewer>
        </div>
      `
    },

    // ─── 2 · THE DAMAGE ───────────────────────────────────────
    {
      id: 'damage',
      eyebrow: 'One strand, up close',
      headline: 'A curl is a bond stack.',
      body: "Every coil is thousands of disulfide bonds wound into a helix. Skip the primer and the stack fractures — 23% bond loss in three washes. The spiral unwinds before the client sits down for the next service.",
      cta: 'See the formula',
      founderClip: '02-damage',
      caption: "Zoom in on a single curl. That golden helix is thousands of disulfide bonds. Skip the primer and the bonds fracture — the spiral unwinds before the next wash.",
      voClip: 'assets/vo/02-damage.mp3',
      arModel: {
        src: 'assets/gilded-hair-spiral.glb',
        iosSrc: 'assets/gilded-hair-spiral.usdz',
        placement: 'floor',
        label: 'See damaged bonds in your space',
      },
      stats: [
        ['Bond loss / 3 cycles',  '23%'],
        ['Moisture loss / wash',  '12%'],
        ['Frizz onset',           '<4 hrs'],
        ['Heat damage threshold', '350°F'],
      ],
      stage: () => `
        <div class="stage-detail stage-molecule">
          <model-viewer
            id="molecule-mv"
            src="assets/gilded-hair-spiral.glb"
            ios-src="assets/gilded-hair-spiral.usdz"
            loading="eager"
            auto-rotate
            auto-rotate-delay="400"
            rotation-per-second="6deg"
            camera-orbit="0deg 76deg 2.8m"
            field-of-view="26deg"
            shadow-intensity="1.6"
            shadow-softness="1"
            exposure="1.35"
            environment-image="legacy"
            tone-mapping="commerce"
            interaction-prompt="none"
            camera-controls
            disable-zoom
            class="stage-model stage-glass">

            <!-- Interactive 3D hotspots — Apple AR Quick Look style.
                 data-position is in the model's local space (meters).
                 data-visibility-attribute="visible" hides hotspots
                 that end up behind geometry as the model rotates. -->
            <button class="hotspot" slot="hotspot-keratin"
                    data-position="0.05 0.55 0.15"
                    data-normal="0 1 0"
                    data-visibility-attribute="visible"
                    data-hotspot-key="keratin">
              <span class="hotspot-dot"></span>
              <span class="hotspot-label">
                <span class="hotspot-label-tag">01</span>
                <span class="hotspot-label-name">Hydrolyzed Keratin</span>
                <span class="hotspot-label-pct">2.4%</span>
                <span class="hotspot-label-desc">Rebuilds bonds</span>
              </span>
            </button>

            <button class="hotspot" slot="hotspot-silk"
                    data-position="-0.35 0.05 0.20"
                    data-normal="-1 0 0"
                    data-visibility-attribute="visible"
                    data-hotspot-key="silk">
              <span class="hotspot-dot"></span>
              <span class="hotspot-label">
                <span class="hotspot-label-tag">02</span>
                <span class="hotspot-label-name">Silk Protein</span>
                <span class="hotspot-label-pct">1.1%</span>
                <span class="hotspot-label-desc">Slip + heat resistance</span>
              </span>
            </button>

            <button class="hotspot" slot="hotspot-argan"
                    data-position="0.30 -0.40 0.20"
                    data-normal="1 -0.5 0"
                    data-visibility-attribute="visible"
                    data-hotspot-key="argan">
              <span class="hotspot-dot"></span>
              <span class="hotspot-label">
                <span class="hotspot-label-tag">03</span>
                <span class="hotspot-label-name">Argan Oil</span>
                <span class="hotspot-label-pct">0.8%</span>
                <span class="hotspot-label-desc">Shine seal · 450°F protect</span>
              </span>
            </button>
          </model-viewer>
        </div>
      `
    },

    // ─── 3 · THE FORMULA ──────────────────────────────────────
    {
      id: 'formula',
      eyebrow: 'PISIM PROTECT™',
      headline: 'Three molecules. One job.',
      body: '',
      cta: 'Run the math',
      founderClip: '03-formula',
      caption: "PISIM PROTECT is three molecules doing one job. Tap any of them.",
      voClip: 'assets/vo/03-formula.mp3',
      molecules: [
        {
          id: 'keratin',
          name: 'Hydrolyzed Keratin',
          weight: '2.4%',
          function: 'Rebuilds disulfide bonds in damaged hair shafts.',
          bondsTo: 'Cysteine residues in the cortex.',
          source: 'Patent · WO2019184829'
        },
        {
          id: 'silk',
          name: 'Silk Protein',
          weight: '1.1%',
          function: 'Adds slip + heat resistance without buildup.',
          bondsTo: 'Cuticle scales via hydrogen bonding.',
          source: 'Sericin · Bombyx mori'
        },
        {
          id: 'argan',
          name: 'Argan Oil (cold-pressed)',
          weight: '0.8%',
          function: 'Thermal protection to 450°F + final shine seal.',
          bondsTo: 'Free fatty acids on the cuticle.',
          source: 'Argania spinosa · Souss Valley'
        },
      ],
      stage: () => `
        <div class="stage-detail stage-portrait-3d">
          <div class="portrait-rim" aria-hidden="true"></div>
          <model-viewer
            id="portrait-mv"
            src="assets/midnight-curls.glb"
            loading="eager"
            auto-rotate
            auto-rotate-delay="400"
            rotation-per-second="4deg"
            camera-orbit="-15deg 82deg 1.6m"
            camera-target="0m 1.55m 0m"
            field-of-view="26deg"
            shadow-intensity="1.3"
            shadow-softness="0.85"
            exposure="1.0"
            environment-image="neutral"
            tone-mapping="commerce"
            interaction-prompt="none"
            disable-zoom
            camera-controls
            class="stage-model">
          </model-viewer>
        </div>
      `
    },

    // ─── 4 · YOUR CHAIR, YOUR MATH ────────────────────────────
    {
      id: 'chair',
      eyebrow: 'The math',
      headline: 'Your chair, a station.',
      body: '',
      cta: 'See the system',
      founderClip: '04-chair',
      caption: "This is your chair. Drag the slider — see what changes when you turn it into a Curl Cult station.",
      voClip: 'assets/vo/04-chair.mp3',
      arModel: {
        src: 'assets/golden-chair.glb',
        iosSrc: 'assets/golden-chair.usdz',
        placement: 'floor',
        label: 'Place this chair on your floor',
        scale: 'fixed',
      },
      roiSlider: true,
      stage: () => `
        <model-viewer
          id="stage-chair"
          src="assets/golden-chair.glb"
          loading="eager"
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-placement="floor"
          camera-controls
          shadow-intensity="1.4"
          shadow-softness="0.75"
          exposure="1.15"
          environment-image="neutral"
          tone-mapping="commerce"
          camera-orbit="-20deg 78deg 2.8m"
          interaction-prompt="none"
          disable-zoom
          class="stage-model">

          <!-- 3D hotspots — tap to reveal station spec -->
          <button class="hotspot" slot="hotspot-seat"
                  data-position="0 0.55 0"
                  data-normal="0 1 0"
                  data-visibility-attribute="visible"
                  data-hotspot-key="seat">
            <span class="hotspot-dot"></span>
            <span class="hotspot-label">
              <span class="hotspot-label-tag">Seat</span>
              <span class="hotspot-label-name">Life-size</span>
              <span class="hotspot-label-desc">Fits a 2-station salon</span>
            </span>
          </button>

          <button class="hotspot" slot="hotspot-base"
                  data-position="0 0.05 0"
                  data-normal="0 1 0"
                  data-visibility-attribute="visible"
                  data-hotspot-key="base">
            <span class="hotspot-dot"></span>
            <span class="hotspot-label">
              <span class="hotspot-label-tag">Base</span>
              <span class="hotspot-label-name">Hydraulic lift</span>
              <span class="hotspot-label-desc">55–70 cm range</span>
            </span>
          </button>
        </model-viewer>
      `
    },

    // ─── 5 · THE SYSTEM ───────────────────────────────────────
    {
      id: 'system',
      eyebrow: 'Eight products',
      headline: 'One workflow.',
      body: '',
      cta: 'Application',
      founderClip: '05-system',
      caption: "Eight products. One workflow. Here's how they sit in your station.",
      voClip: 'assets/vo/05-system.mp3',
      products: [
        // Starter 3 — shown prominently, tappable
        { id: 'magic-spell',   name: 'Magic Spell',          cost: '$32', dose: '2–4 pumps',     who: 'All curl patterns',  when: 'Step 1 · Damp hair',    tier: 'starter' },
        { id: 'conditioner',   name: 'Hydrating Conditioner', cost: '$28', dose: 'Quarter-size',  who: 'All hair types',     when: 'Pre-shampoo',           tier: 'starter' },
        { id: 'curl-cream',    name: 'Curl Cream',           cost: '$30', dose: '1–3 pumps',     who: 'Wavy → Coily',       when: 'Step 2 · Damp hair',    tier: 'starter' },
        // The system — shown as locked, teased, unlocked after certification
        { id: 'leave-in',      name: 'Leave-In Mist',        cost: '$24', dose: '4–6 sprays',    who: 'Refresh / day 2',    when: 'Daily refresh',         tier: 'locked' },
        { id: 'protein-mask',  name: 'Protein Mask',         cost: '$38', dose: '1 packet',      who: 'Damaged · over-bleached', when: 'Weekly · 12 min', tier: 'locked' },
        { id: 'oil',           name: 'Finishing Oil',        cost: '$26', dose: '2–3 drops',     who: 'Coarse + dry',       when: 'Final · before diffuse', tier: 'locked' },
        { id: 'gel',           name: 'Definition Gel',       cost: '$28', dose: '1–2 pumps',     who: 'Tight curls · coils', when: 'Cast hold',             tier: 'locked' },
        { id: 'cleanser',      name: 'Co-Cleanser',          cost: '$30', dose: '2 pumps',       who: 'Low-poo · co-wash',  when: 'Weekly cleanse',        tier: 'locked' },
      ],
      stage: () => `
        <div class="stage-lineup">
          <div class="lineup-slot lineup-slot-l">
            <model-viewer src="assets/conditioner-new.glb"
              loading="eager"
              auto-rotate rotation-per-second="28deg"
              camera-orbit="0deg 72deg 2.6m" exposure="1.3"
              shadow-intensity="1" shadow-softness="1"
              environment-image="neutral"
              interaction-prompt="none" disable-pan disable-zoom
              class="stage-model-small">
            </model-viewer>
            <span class="lineup-tag">CONDITIONER</span>
          </div>
          <div class="lineup-slot lineup-slot-c">
            <model-viewer src="assets/bottle-opt.glb"
              loading="eager"
              auto-rotate rotation-per-second="22deg"
              camera-orbit="0deg 72deg 2.4m" exposure="1.3"
              shadow-intensity="1.2" shadow-softness="1"
              environment-image="neutral"
              interaction-prompt="none" disable-pan disable-zoom
              class="stage-model">
            </model-viewer>
            <span class="lineup-tag">MAGIC SPELL</span>
          </div>
          <div class="lineup-slot lineup-slot-r">
            <model-viewer src="assets/cream-new.glb"
              loading="eager"
              auto-rotate auto-rotate-delay="600" rotation-per-second="28deg"
              camera-orbit="0deg 72deg 2.6m" exposure="1.3"
              shadow-intensity="1" shadow-softness="1"
              environment-image="neutral"
              interaction-prompt="none" disable-pan disable-zoom
              class="stage-model-small">
            </model-viewer>
            <span class="lineup-tag">CURL CREAM</span>
          </div>
        </div>
      `
    },

    // ─── 6 · THE APPLICATION ──────────────────────────────────
    {
      id: 'application',
      eyebrow: 'Technique',
      headline: 'Spray. Work. Diffuse.',
      body: '',
      cta: 'Get certified',
      founderClip: '06-application',
      caption: "Spray. Work it through mid-shaft to ends. Two pumps for fine, four for coarse. Diffuse on low.",
      voClip: 'assets/vo/06-application.mp3',
      arModel: {
        src: 'assets/bottle-opt.glb',
        iosSrc: 'assets/bottle-opt.usdz',
        placement: 'floor',
        label: 'Place Magic Spell on your counter',
      },
      dosageDial: true,
      stage: () => {
        const model = PRODUCT_MODEL_MAP[selectedProductId];
        const src = model ? model.src : 'assets/bottle-opt.glb';
        return `
          <div class="stage-detail">
            <model-viewer
              src="${src}"
              loading="eager"
              ar
              ar-modes="webxr scene-viewer quick-look"
              auto-rotate rotation-per-second="14deg"
              camera-orbit="-15deg 85deg 2.2m" exposure="1.3"
              shadow-intensity="1.2" shadow-softness="1"
              environment-image="neutral"
              tone-mapping="commerce"
              interaction-prompt="none" disable-zoom
              class="stage-model">

              <!-- Tap the trigger → pump count; tap the label → timing -->
              <button class="hotspot" slot="hotspot-trigger"
                      data-position="0 0.45 0.08"
                      data-normal="0 0 1"
                      data-visibility-attribute="visible"
                      data-hotspot-key="trigger">
                <span class="hotspot-dot"></span>
                <span class="hotspot-label">
                  <span class="hotspot-label-tag">Dose</span>
                  <span class="hotspot-label-name">2–4 pumps</span>
                  <span class="hotspot-label-desc">Fine → Coarse hair</span>
                </span>
              </button>

              <button class="hotspot" slot="hotspot-label"
                      data-position="0 0.10 0.11"
                      data-normal="0 0 1"
                      data-visibility-attribute="visible"
                      data-hotspot-key="label">
                <span class="hotspot-dot"></span>
                <span class="hotspot-label">
                  <span class="hotspot-label-tag">When</span>
                  <span class="hotspot-label-name">Step 1 · Damp hair</span>
                  <span class="hotspot-label-desc">Before diffusing</span>
                </span>
              </button>
            </model-viewer>
          </div>
        `;
      }
    },

    // ─── 7 · CERTIFIED ────────────────────────────────────────
    {
      id: 'certified',
      eyebrow: 'You\'re in',
      headline: 'Certified.',
      body: 'Your card carries a 20% code for your roster.',
      cta: 'Send link',
      formField: true,
      founderClip: '07-certified',
      caption: "You're in. This card is yours. Send it to your client roster — it doubles as a discount.",
      voClip: 'assets/vo/07-certified.mp3',
      arModel: {
        src: 'assets/liquid-drop.glb',
        iosSrc: 'assets/liquid-drop.usdz',
        placement: 'floor',
        label: 'Place the formula in your space',
      },
      stage: () => `
        <div class="stage-capture">
          <model-viewer
            class="stage-capture-ring"
            src="assets/hair-ring.glb"
            ios-src="assets/hair-ring.usdz"
            loading="eager"
            reveal="auto"
            auto-rotate
            auto-rotate-delay="0"
            rotation-per-second="22deg"
            camera-orbit="0deg 82deg 1.1m"
            field-of-view="26deg"
            disable-zoom
            disable-pan
            interaction-prompt="none"
            exposure="1.05"
            environment-image="neutral"
            tone-mapping="commerce"
            shadow-intensity="0"
            aria-hidden="true">
          </model-viewer>
          <img src="assets/logo.svg" class="stage-capture-logo" alt="CURL CULT">
        </div>
      `
    }

  ];

  // ───────────────────────────────────────────────────────────────
  // STATE
  // ───────────────────────────────────────────────────────────────
  let currentChapter = 0;
  let sessionStarted = false;
  let selectedProductId = 'magic-spell'; // user's pick from chapter 5 lineup
  let quizPassed = false;                 // gate before chapter 7 (certification)

  function isSystemUnlocked() { return quizPassed; }

  // ═══════════════════════════════════════════════════════════════
  // ASSET PRELOADER — fetch all heavy assets up-front, track real
  // progress via streamed bytes, and gate BEGIN until done.
  // ═══════════════════════════════════════════════════════════════
  // Preload only the bare minimum to unlock BEGIN. The model-viewer
  // in each chapter's stage loads its own GLB lazily (loading="eager"
  // kicks in the moment the chapter mounts), so we don't need to pull
  // 250MB of models up front. That was stalling mobile browsers into
  // a tab-kill → "back to landing" loop.
  const PRELOAD_ASSETS = [
    'assets/logo.svg',
    'assets/draco/draco_decoder.wasm',
    'assets/draco/draco_wasm_wrapper.js',
  ];

  let preloadProgress = 0;
  let preloadComplete = false;
  let preloadDone = 0;
  let preloadTotal = 0;

  // Hard cap: if preload takes more than this long, unlock BEGIN anyway.
  // Some tunnels (localtunnel, ngrok free) buffer responses and the
  // streaming progress never updates. Don't keep the user waiting.
  const PRELOAD_TIMEOUT_MS = 8000;

  function unlockBegin(reason) {
    if (preloadComplete) return;
    preloadComplete = true;
    preloadProgress = 1;
    const btn = $('#btn-begin');
    const label = $('#btn-begin-label');
    const fill = $('#btn-begin-fill');
    const foot = $('#landing-foot');
    if (btn) {
      btn.classList.remove('is-loading');
      btn.classList.add('is-ready');
      btn.disabled = false;
    }
    if (fill) fill.style.width = '100%';
    if (label) label.textContent = 'Begin';
    if (foot) foot.textContent = "Uses your phone's AR · Works best on a flat floor";
    if (navigator.vibrate) navigator.vibrate(8);
    debug.log(`✓ BEGIN unlocked · ${reason}`);
    track('preload_complete', { reason });
  }

  function updatePreloadUI() {
    const fill = document.getElementById('btn-begin-fill');
    const label = document.getElementById('btn-begin-label');
    const pct = Math.round(preloadProgress * 100);
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = preloadComplete ? 'Begin' : `Loading ${pct}%`;
  }

  async function preloadAllAssets() {
    preloadTotal = PRELOAD_ASSETS.length;
    preloadDone = 0;

    // Start a hard timeout — unlock BEGIN no matter what after N ms
    const timeoutHandle = setTimeout(() => {
      if (!preloadComplete) unlockBegin('timeout');
    }, PRELOAD_TIMEOUT_MS);

    // Soft "stuck" detection: if 3 seconds pass and we haven't completed
    // a single asset, fall back to a fake progress animation so the user
    // sees motion (better than a frozen 0%).
    let fakeProgressTimer = null;
    setTimeout(() => {
      if (preloadDone === 0 && !preloadComplete) {
        debug.log('Preload stalled — animating fake progress');
        let fake = 0;
        fakeProgressTimer = setInterval(() => {
          if (preloadComplete) { clearInterval(fakeProgressTimer); return; }
          fake += 0.04;
          if (fake > 0.95) fake = 0.95;
          // Only override if real progress is lower
          if (fake > preloadProgress) {
            preloadProgress = fake;
            updatePreloadUI();
          }
        }, 250);
      }
    }, 3000);

    // Fire all fetches in parallel. We DO NOT use streamed reading —
    // tunnels often buffer responses, which prevents the streamed bytes
    // from arriving smoothly. Instead, count completed assets.
    const promises = PRELOAD_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
        // Read the body so it lands in browser cache. We don't need the value.
        if (res.ok && res.body) {
          await res.blob();
        }
        debug.log(`Preloaded · ${url.split('/').pop()}`);
      } catch (e) {
        debug.warn(`Preload failed · ${url}: ${e.message}`);
      } finally {
        preloadDone++;
        preloadProgress = Math.min(preloadDone / preloadTotal, 1);
        updatePreloadUI();
      }
    });

    await Promise.allSettled(promises);
    if (fakeProgressTimer) clearInterval(fakeProgressTimer);
    clearTimeout(timeoutHandle);
    unlockBegin('all-loaded');
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION BOOT — persistent AR via camera passthrough
  // ───────────────────────────────────────────────────────────────
  // BEGIN tap is the user gesture that satisfies iOS Safari's camera
  // permission requirement. We request the rear camera once, pipe it
  // into a fullscreen <video>, and then chapters compose on top. No
  // jumping in and out of native AR — it's all one persistent session.
  // ═══════════════════════════════════════════════════════════════
  async function beginSession() {
    if (sessionStarted) return;
    if (!preloadComplete) {
      debug.log('beginSession: preload not finished, ignoring tap');
      return;
    }
    sessionStarted = true;

    track('session_begin');
    debug.log('Session begin · requesting camera');

    // Audio: start ambient bed on this user gesture (satisfies
    // autoplay policy), play the begin swoop.
    try { window.cc && cc.begin(); setTimeout(() => cc.ambient(), 400); } catch (_) {}

    // Hide landing
    const landing = $('#landing');
    landing.classList.add('hide');
    setTimeout(() => { landing.hidden = true; }, 500);

    // Reveal HUD + stage + sheet
    $('#hud-top').hidden = false;
    $('#chapter-stage').hidden = false;
    $('#chapter-sheet').hidden = false;
    document.body.classList.add('unlocked');

    // Show a pre-explainer toast *before* the permission prompt so the user
    // knows why we're asking. iOS Safari triggers the sheet the instant
    // getUserMedia is called — the toast gives ~200ms of context first.
    if (!sessionStorage.getItem('cc_cam_explained')) {
      showToast('We use your camera so products appear in your space');
      sessionStorage.setItem('cc_cam_explained', '1');
    }

    // Small delay so the toast lands before the native permission sheet
    await new Promise(r => setTimeout(r, 250));

    // Try to start the rear camera. If it fails (denied / unavailable),
    // we still play the experience with a black background — graceful.
    await startCameraPassthrough();

    // Render the first chapter
    renderChapter(0);

    // Haptic welcome pulse
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  }

  async function startCameraPassthrough() {
    const video = $('#cam-feed');
    const vignette = $('#cam-vignette');
    if (!video) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      debug.warn('getUserMedia unavailable — playing without camera');
      document.body.classList.add('no-camera');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.srcObject = stream;
      video.hidden = false;
      vignette.hidden = false;
      document.body.classList.add('camera-on');
      debug.log('✓ Camera passthrough live');
      track('camera_started');
    } catch (e) {
      debug.warn(`Camera denied/failed: ${e.name} ${e.message}`);
      document.body.classList.add('no-camera');
      track('camera_denied', { name: e.name });
      // Show a retry banner — previously this failed silently and the
      // entire experience looked like a plain dark-mode web page.
      const banner = document.getElementById('camera-denied-banner');
      if (banner) banner.hidden = false;
    }
  }

  // Retry camera from the banner — with visible loading state so the user
  // knows their tap registered while getUserMedia is negotiating.
  document.addEventListener('click', (e) => {
    if (e.target?.id !== 'camera-denied-retry') return;
    e.preventDefault();
    const retryBtn = e.target;
    const banner = document.getElementById('camera-denied-banner');
    if (retryBtn.dataset.busy === '1') return; // debounce
    retryBtn.dataset.busy = '1';
    const prevLabel = retryBtn.textContent;
    retryBtn.textContent = 'Retrying…';
    retryBtn.disabled = true;
    document.body.classList.remove('no-camera');
    startCameraPassthrough().finally(() => {
      retryBtn.dataset.busy = '0';
      retryBtn.disabled = false;
      if (document.body.classList.contains('camera-on') && banner) {
        banner.hidden = true;
      } else {
        retryBtn.textContent = prevLabel;
      }
    });
  });

  function stopCameraPassthrough() {
    const video = $('#cam-feed');
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      video.hidden = true;
    }
    $('#cam-vignette').hidden = true;
    document.body.classList.remove('camera-on');
  }
  // Stop camera when the page unloads (avoid green dot stuck on)
  window.addEventListener('pagehide', stopCameraPassthrough);
  window.addEventListener('beforeunload', stopCameraPassthrough);

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // CHAPTER RENDERING
  // ═══════════════════════════════════════════════════════════════
  function renderChapter(index) {
    if (index < 0 || index >= CHAPTERS.length) {
      debug.warn(`Chapter index out of bounds: ${index}`);
      return;
    }

    const ch = CHAPTERS[index];
    currentChapter = index;

    // Minimal dot indicator (Apple-style progress) — dots are buttons
    // so screen readers + keyboard users can jump between chapters.
    const counter = $('#hud-counter');
    if (counter) {
      counter.innerHTML = CHAPTERS.map((c, i) =>
        `<button type="button"
                 class="hud-dot${i === index ? ' active' : ''}"
                 data-jump="${i}"
                 aria-label="Chapter ${i + 1}: ${c.eyebrow.replace(/^—\s*/, '').replace(/"/g, '&quot;')}"
                 aria-current="${i === index ? 'step' : 'false'}"></button>`
      ).join('');
    }

    // Populate the chapter STAGE (large model-viewer or HTML hero)
    const stageInner = $('#stage-inner');
    if (stageInner && ch.stage) {
      const stage = $('#chapter-stage');
      stage.classList.remove('enter');
      // Inject the chapter's visual stage + (if AR-enabled) a hidden
      // ar-placer model-viewer that handles the native AR handoff.
      let html = ch.stage();
      const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
      // On iOS, Quick Look requires a .usdz sibling. Without it, the
      // AR button does nothing useful — so skip injecting the placer
      // and skip the AR hint for chapters without iosSrc on iOS.
      const arUsable = ch.arModel && !(isIOS && !ch.arModel.iosSrc);
      if (arUsable) {
        const iosAttr = ch.arModel.iosSrc ? `ios-src="${ch.arModel.iosSrc}"` : '';
        const scaleAttr = ch.arModel.scale ? `ar-scale="${ch.arModel.scale}"` : '';
        const hintLabel = ch.arModel.label || 'Tap to place in your room';
        // Immersion upgrades on the AR placer:
        //   ar-modes="webxr scene-viewer quick-look" → best available first
        //   xr-environment + environment-image="legacy" → WebXR lighting estimation so
        //     the model picks up real-room color temperature (Chrome/Android)
        //   shadow-intensity="1.4" + soft shadow → grounds the model on the floor
        //   min-camera-orbit prevents the user from going below the floor
        html += `
          <model-viewer
            id="ar-placer"
            class="ar-placer"
            src="${ch.arModel.src}"
            ${iosAttr}
            ${scaleAttr}
            loading="eager"
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-placement="${ch.arModel.placement || 'floor'}"
            xr-environment
            ar-scale="${ch.arModel.scale || 'auto'}"
            environment-image="legacy"
            tone-mapping="commerce"
            camera-controls
            interaction-prompt="none"
            disable-zoom
            disable-pan
            shadow-intensity="1.4"
            shadow-softness="0.9"
            min-camera-orbit="auto auto auto"
            style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;">
          </model-viewer>
          <button type="button" class="ar-hint" data-ar-place aria-label="${hintLabel}">
            <span class="ar-hint-dot"></span>
            <span>Tap to place</span>
          </button>
        `;
      }
      stageInner.innerHTML = html;

      // Use setTimeout (not rAF) — A-Frame warns about "rAF timed out"
      // because MindAR injection also requests rAF, causing throttling.
      setTimeout(() => {
        // Wire material overrides first (they fire on 'load' event)
        $$('#stage-inner model-viewer[data-clean-label="true"]').forEach(mv => {
          mv.addEventListener('load', () => applyCleanLabelMaterial(mv), { once: true });
        });

        // Hide butterflies scene-dressing (chapters 6, 7)
        const bfList = $$('#stage-inner model-viewer[data-hide-scenery="true"]');
        if (bfList.length) debug.log(`Butterflies scenery poll · ${bfList.length}`);
        bfList.forEach((mv) => {
          let tries = 0;
          const poll = () => {
            const mats = mv?.model?.materials || [];
            if (mats.length > 0) { hideButterfliesScenery(mv); return; }
            if (tries++ < 30) setTimeout(poll, 300);
          };
          poll();
        });

        // Reduce butterflies to 3-4 on the garden stage (chapter 1)
        const bfGarden = $$('#stage-inner model-viewer[data-reduce-butterflies="true"]');
        if (bfGarden.length) debug.log(`Butterflies garden poll · ${bfGarden.length}`);
        bfGarden.forEach((mv) => {
          let tries = 0;
          const poll = () => {
            const mats = mv?.model?.materials || [];
            if (mats.length > 0) { hideMostButterflies(mv); return; }
            if (tries++ < 30) setTimeout(poll, 300);
          };
          poll();
        });

        // Chapter 2's liquid-drop sculpture ships with materials already
        // baked in (mahogany glass drop/spiral + amber bubbles), so no
        // runtime material override is needed.

        // Portrait material: single PBR for skin + hair + clothing, so
        // roughness must be a compromise. 0.78 keeps the skin matte
        // (killing the flashy specular) while the hair still picks up
        // enough ambient/rim light to show curl structure. No metallic.
        const portraitMV = document.querySelector('#stage-inner #portrait-mv');
        if (portraitMV) {
          const tunePortrait = () => {
            const mats = portraitMV?.model?.materials || [];
            if (!mats.length) { setTimeout(tunePortrait, 200); return; }
            mats.forEach(m => {
              const pbr = m.pbrMetallicRoughness;
              if (!pbr) return;
              pbr.setRoughnessFactor(0.78);
              pbr.setMetallicFactor(0);
              try {
                m.setEmissiveFactor && m.setEmissiveFactor([0, 0, 0]);
              } catch (_) {}
            });
            debug.log('Portrait tuned · roughness 0.78');
          };
          if (portraitMV.loaded) tunePortrait();
          else portraitMV.addEventListener('load', tunePortrait, { once: true });
          setTimeout(tunePortrait, 2000); // safety net
        }

        // Chair matte-black override disabled — we ship a pre-textured
        // golden-chair.glb now, so leave its materials as authored.
        // const chairMV = document.getElementById('stage-chair');
        // if (chairMV) {
        //   chairMV.addEventListener('load', () => applyChairMatteBlackMaterialWithRetry(chairMV), { once: true });
        // }

        void stage.offsetWidth; // reflow
        stage.classList.add('enter');

        // Belt-and-suspenders: dismissPoster on all stage model-viewers
        setTimeout(() => {
          $$('#stage-inner model-viewer').forEach((mv) => {
            try { mv.dismissPoster && mv.dismissPoster(); } catch (_) {}
            // Hotspot annotations: model-viewer keeps its annotation
            // container `display: none` when idle. Force-visible so our
            // peach dots render. Re-runs if shadow DOM rebuilds.
            const showAnnotations = () => {
              if (!mv.shadowRoot) return;
              Array.from(mv.shadowRoot.querySelectorAll('div')).forEach(div => {
                if (div.style.display === 'none' && div.querySelector('.annotation-wrapper')) {
                  div.style.display = 'block';
                }
              });
            };
            showAnnotations();
            // Re-apply once on model-load in case mv rebuilds annotations
            mv.addEventListener('load', showAnnotations, { once: true });
          });
        }, 300);
      }, 0);
    }

    const body    = $('#sheet-body');
    const actions = $('#sheet-actions');

    let bodyHTML = `
      <p class="sheet-eyebrow">${ch.eyebrow}</p>
      <h2 class="sheet-headline">${ch.headline}</h2>
      <p class="sheet-copy">${ch.body}</p>
    `;

    if (ch.formField) {
      bodyHTML += `
        <label class="sheet-field">
          <span class="field-label">Email or phone</span>
          <input type="email"
                 id="contact-input"
                 inputmode="email"
                 autocomplete="email"
                 autocapitalize="off"
                 autocorrect="off"
                 spellcheck="false"
                 placeholder="you@salon.com">
          <p class="form-hint">One link. No spam.</p>
          <p id="form-feedback" class="form-feedback" aria-live="polite"></p>
        </label>
      `;
    }

    // (Removed dead lineup-pills branch — ch.id === 'lineup' never matched.
    //  Product selection now flows through the carousel cards in ch.products.)

    // ── Damage stats (chapter 2) ─────────────────────────────────
    if (ch.stats) {
      bodyHTML += `<ul class="stat-list">`;
      ch.stats.forEach(([label, value]) => {
        bodyHTML += `<li><span class="stat-label">${label}</span><span class="stat-num">${value}</span></li>`;
      });
      bodyHTML += `</ul>`;
    }

    // ── Molecule chips + detail panel (chapter 3) ────────────────
    if (ch.molecules) {
      bodyHTML += `<div class="molecule-grid">`;
      ch.molecules.forEach((m) => {
        bodyHTML += `
          <button class="molecule-chip" data-mol="${m.id}">
            <span class="molecule-chip-name">${m.name}</span>
            <span class="molecule-chip-pct">${m.weight}</span>
          </button>
        `;
      });
      bodyHTML += `</div>`;
      bodyHTML += `
        <div class="molecule-detail" id="mol-detail">
          <strong>Tap a molecule above</strong> to see how it works.
        </div>
      `;
    }

    // ── ROI slider (chapter 4) ───────────────────────────────────
    if (ch.roiSlider) {
      bodyHTML += `
        <div class="roi-widget">
          <div class="roi-slider-row">
            <span class="roi-slider-key">Services / week</span>
            <span class="roi-slider-val" id="roi-svc">2</span>
          </div>
          <input type="range" min="1" max="8" value="2" class="roi-slider" id="roi-input">
          <div class="roi-slider-row roi-slider-meta">
            <span>1</span><span>8</span>
          </div>
          <div class="roi-breakdown" id="roi-breakdown">
            <div class="roi-row"><span>Base</span><span id="roi-base">$15,600</span></div>
            <div class="roi-row"><span>Retail attach · 25%</span><span id="roi-retail">$3,900</span></div>
            <div class="roi-row"><span>Referral lift · 30%</span><span id="roi-lift">$5,850</span></div>
          </div>
          <div class="roi-result">
            <span class="roi-result-label">Annual lift</span>
            <span class="roi-result-amount" id="roi-amount">$25,350</span>
          </div>
          <button type="button" class="btn-roi-save" data-roi-save>
            <span class="roi-save-glyph">↓</span>
            <span>Save this math</span>
          </button>
        </div>
      `;
    }

    // ── Product carousel (chapter 5) ────────────────────────────
    // "Starter 3" section + locked "Full system" section. Narrative:
    // here's what you need today, here's what certification unlocks.
    if (ch.products) {
      const unlocked = isSystemUnlocked();
      const starters = ch.products.filter(p => p.tier === 'starter');
      const locked   = ch.products.filter(p => p.tier === 'locked');
      const lockedActive = unlocked; // once certified, locked becomes tappable

      const makeSlide = (p, i, isLocked) => {
        const archetype = PRODUCT_DETAILS[p.id]?.profile || '';
        const lockedCls = isLocked && !lockedActive ? ' is-locked' : '';
        return `
          <button class="product-slide${lockedCls}" data-product-info="${p.id}" data-slide="${i}" ${isLocked && !lockedActive ? 'aria-disabled="true"' : ''}>
            <span class="slide-idx">${String(i + 1).padStart(2, '0')}${isLocked && !lockedActive ? ' <span class="slide-lock">✦</span>' : ''}</span>
            <span class="slide-name">${p.name}</span>
            ${archetype ? `<span class="slide-archetype">${archetype}</span>` : ''}
            <span class="slide-meta">${p.cost} · ${p.dose}</span>
            <span class="slide-who">${p.who}</span>
            <span class="slide-when">${p.when}</span>
          </button>
        `;
      };

      bodyHTML += `
        <div class="system-section">
          <p class="system-section-title">The Starter 3</p>
          <div class="product-carousel is-starter" id="product-carousel">
            ${starters.map((p, i) => makeSlide(p, i, false)).join('')}
          </div>
          <div class="carousel-dots" role="tablist" aria-label="Starter products">
            ${starters.map((p, i) => `
              <button type="button" class="carousel-dot${i === 0 ? ' active' : ''}" data-carousel-jump="${i}" role="tab" aria-label="Go to ${p.name}"></button>
            `).join('')}
          </div>
        </div>
        <div class="system-section system-section-locked">
          <p class="system-section-title">
            The Full System
            ${unlocked ? '<span class="system-unlocked-chip">Unlocked</span>' : '<span class="system-locked-chip">Unlock after certification</span>'}
          </p>
          <div class="product-grid">
            ${locked.map((p, i) => makeSlide(p, starters.length + i, true)).join('')}
          </div>
        </div>
      `;
    }

    // ── Dosage dial + motion teach (chapter 6) ──────────────────
    if (ch.dosageDial) {
      bodyHTML += `
        <div class="dosage-widget">
          <div class="dosage-pills">
            <button class="dosage-pill" data-coarseness="fine">Fine</button>
            <button class="dosage-pill active" data-coarseness="medium">Medium</button>
            <button class="dosage-pill" data-coarseness="coarse">Coarse</button>
          </div>
          <div class="dosage-result">
            <div class="dosage-cell">
              <span class="dosage-cell-label">Pumps</span>
              <span class="dosage-cell-value" id="dose-pumps">3</span>
            </div>
            <div class="dosage-cell">
              <span class="dosage-cell-label">Work-in</span>
              <span class="dosage-cell-value" id="dose-work">20s</span>
            </div>
            <div class="dosage-cell">
              <span class="dosage-cell-label">Diffuse</span>
              <span class="dosage-cell-value" id="dose-diffuse">6m</span>
            </div>
          </div>
          <!-- Motion teach: subtle animated pattern cycling Spray → Work → Diffuse.
               The three phases light up in sequence — kinesthetic preview of technique. -->
          <div class="motion-teach" aria-hidden="true">
            <div class="motion-phase" data-phase="spray">
              <svg viewBox="0 0 40 40" class="motion-glyph">
                <circle cx="6" cy="8" r="1.4" class="mist"/>
                <circle cx="10" cy="14" r="1.1" class="mist"/>
                <circle cx="14" cy="10" r="1.2" class="mist"/>
                <circle cx="18" cy="18" r="1.3" class="mist"/>
                <circle cx="22" cy="12" r="1" class="mist"/>
                <circle cx="26" cy="20" r="1.2" class="mist"/>
                <circle cx="30" cy="16" r="1" class="mist"/>
                <circle cx="34" cy="22" r="1.1" class="mist"/>
              </svg>
              <span class="motion-label">Spray</span>
            </div>
            <div class="motion-arrow">→</div>
            <div class="motion-phase" data-phase="work">
              <svg viewBox="0 0 40 40" class="motion-glyph">
                <path d="M6 20 Q14 8 22 20 T38 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" class="squiggle"/>
              </svg>
              <span class="motion-label">Work</span>
            </div>
            <div class="motion-arrow">→</div>
            <div class="motion-phase" data-phase="diffuse">
              <svg viewBox="0 0 40 40" class="motion-glyph">
                <g class="diffuse-rays">
                  <line x1="20" y1="20" x2="20" y2="4"  stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  <line x1="20" y1="20" x2="32" y2="8"  stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  <line x1="20" y1="20" x2="36" y2="20" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  <line x1="20" y1="20" x2="32" y2="32" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  <line x1="20" y1="20" x2="20" y2="36" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  <line x1="20" y1="20" x2="8"  y2="32" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  <line x1="20" y1="20" x2="4"  y2="20" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  <line x1="20" y1="20" x2="8"  y2="8"  stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </g>
              </svg>
              <span class="motion-label">Diffuse</span>
            </div>
          </div>
        </div>
      `;
    }

    body.innerHTML = bodyHTML;

    // ── Wire up the freshly-rendered widgets ─────────────────────
    wireChapterWidgets(ch);

    // ── Caption + voiceover ──────────────────────────────────────
    renderVoCaption(ch);
    playVoForChapter(ch);

    // ── Sheet collapsed/expanded default per chapter ─────────────
    // Ch5 "One workflow" leads with the 3D product lineup, so the sheet
    // starts PEEK so the three bottles are the first thing the user
    // sees. All other chapters start EXPANDED.
    setSheetState(ch.id === 'system' ? 'peek' : 'expanded');

    // ── Per-chapter haptic beat — each chapter has a distinct
    // physical signature so the rhythm of the narrative is felt, not
    // just seen. Silent on devices without navigator.vibrate.
    if (navigator.vibrate) {
      const HAPTIC_BEATS = {
        threshold:   [10, 30, 10],             // welcome — steady heartbeat
        damage:      [4, 20, 4, 20, 4, 20, 4], // staccato — bonds breaking
        formula:     [12, 60, 12],             // two taps — molecules locking
        chair:       [6, 10, 6, 10, 18],       // build-up — money moment
        system:      [8],                      // calm — overview
        application: [4, 15, 4, 15, 4],        // spray-spray-spray rhythm
        certified:   [12, 40, 12, 40, 25],     // celebratory triplet
      };
      const beat = HAPTIC_BEATS[ch.id];
      if (beat) navigator.vibrate(beat);
    }

    // ── Per-chapter color theme (breaks monotony) ────────────────
    // dark = default charcoal, warm = amber revenue, light = cream
    // products, glow = accent-saturated celebration
    // All chapters now flat black — themes disabled.
    const CHAPTER_THEMES = {
      threshold:   'dark',
      damage:      'dark',
      formula:     'dark',
      chair:       'dark',
      system:      'dark',
      application: 'dark',
      certified:   'dark',
    };
    document.body.dataset.theme = CHAPTER_THEMES[ch.id] || 'dark';

    let actionsHTML = '';
    // Just a thin back arrow + the primary CTA. Nothing else.
    if (index > 0) {
      actionsHTML += `<button class="btn-back-arrow" data-prev aria-label="Back">←</button>`;
    }
    if (ch.cta) {
      actionsHTML += `<button class="btn-primary" data-next><span>${ch.cta}</span><span class="arrow">→</span></button>`;
    }
    actions.innerHTML = actionsHTML;

    // (Per-chapter haptic beat fires earlier during render — no generic pulse here)

    const sheet = $('#chapter-sheet');
    sheet.classList.remove('enter');
    void sheet.offsetWidth;
    sheet.classList.add('enter');

    // Screen-reader announcement for chapter changes
    const announcer = document.getElementById('chapter-announcer');
    if (announcer) {
      announcer.textContent = `Chapter ${index + 1} of ${CHAPTERS.length}. ${ch.headline}`;
    }

    // Chapter chime — audio cue for the transition
    if (sessionStarted) {
      try { window.cc && cc.chime(); } catch (_) {}
    }

    // GSAP entrance choreography — staggered reveal of sheet elements
    if (window.gsap) {
      const tl = gsap.timeline();
      tl.fromTo($('#chapter-sheet .sheet-eyebrow'), { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', clearProps: 'opacity,transform' }, 0.05)
        .fromTo($('#chapter-sheet .sheet-headline'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, ease: 'power3.out', clearProps: 'opacity,transform' }, 0.12)
        .fromTo($('#chapter-sheet .sheet-copy'), { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', clearProps: 'opacity,transform' }, 0.22)
        .fromTo('#chapter-sheet .stat-list li, #chapter-sheet .molecule-chip, #chapter-sheet .product-slide, #chapter-sheet .roi-widget, #chapter-sheet .dosage-widget, #chapter-sheet .sheet-field',
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.06, clearProps: 'opacity,transform' },
          0.3)
        .fromTo('#chapter-sheet .sheet-actions > *', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', stagger: 0.08, clearProps: 'opacity,transform' }, 0.42);
    }

    track('chapter_render', { chapter: ch.id, index });
    debug.log(`Chapter ${index + 1}/${CHAPTERS.length} · ${ch.id}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // AR SURFACE PLACEMENT — launch native AR (Scene Viewer / Quick
  // Look / WebXR) for the current chapter's primary 3D model.
  // Falls back to opening the GLB in a new tab on desktop.
  // ═══════════════════════════════════════════════════════════════
  function activateChapterAR() {
    const ch = CHAPTERS[currentChapter];
    if (!ch || !ch.arModel) {
      debug.warn('No AR model for this chapter');
      return;
    }
    // First try the hidden placeholder in the stage that has `ar` enabled
    const placer = document.getElementById('ar-placer');
    if (placer && placer.canActivateAR) {
      track('ar_activate', { chapter: ch.id, model: ch.arModel.src });
      debug.log(`AR activate · ${ch.id} · ${ch.arModel.src}`);
      try {
        placer.activateAR();
        return;
      } catch (e) {
        debug.error(`activateAR failed: ${e.message}`);
      }
    }
    // Desktop / no-AR fallback — show a graceful modal instead of opening
    // a raw .glb (which just downloads or shows "can't display").
    debug.log(`AR not supported here · ${ch.arModel.src}`);
    track('ar_unsupported', { chapter: ch.id });
    showArNotSupportedModal(ch);
  }

  function showArNotSupportedModal(ch) {
    const existing = document.getElementById('ar-unsupported-modal');
    if (existing) existing.remove();
    const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    let hint;
    if (!isIOS && !isAndroid) {
      hint = 'Open this page on your iPhone or Android to place it in your space. Scan the QR code on the booth card.';
    } else if (isIOS) {
      hint = 'AR requires iOS 15+ with Safari. Make sure Motion & Orientation Access is enabled.';
    } else {
      hint = "AR requires Chrome on Android with Google Play Services for AR.";
    }
    const modal = document.createElement('div');
    modal.id = 'ar-unsupported-modal';
    modal.className = 'salon-modal';
    modal.innerHTML = `
      <div class="salon-modal-inner">
        <button class="salon-modal-close" data-card-close aria-label="Close">×</button>
        <p class="salon-modal-eyebrow">— AR unavailable</p>
        <h3 class="ar-modal-title">${ch.arModel.label || 'Place it in your space'}</h3>
        <p class="ar-modal-body">${hint}</p>
        <div class="salon-modal-actions">
          <button class="btn-primary" data-card-close><span>Got it</span><span class="arrow">→</span></button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ═══════════════════════════════════════════════════════════════
  // SHEET STATE — peek vs expanded
  // ───────────────────────────────────────────────────────────────
  // Two states only:
  //   peek      → only the headline + primary CTA visible (fast nav)
  //   expanded  → full body, widgets, all actions
  // User toggles via the handle. Auto-reset to default on chapter change.
  // ═══════════════════════════════════════════════════════════════
  let sheetState = 'expanded';
  function setSheetState(state) {
    sheetState = state === 'peek' ? 'peek' : 'expanded';
    const sheet = document.getElementById('chapter-sheet');
    if (sheet) sheet.dataset.state = sheetState;
    // Keep aria-expanded on the handle in sync for screen readers
    const handle = document.querySelector('.sheet-handle');
    if (handle) handle.setAttribute('aria-expanded', sheetState === 'expanded' ? 'true' : 'false');
    // Body class so other elements (like the caption) can react to position
    document.body.classList.toggle('sheet-peek', sheetState === 'peek');
    if (navigator.vibrate) navigator.vibrate(6);
  }
  function toggleSheetState() {
    setSheetState(sheetState === 'peek' ? 'expanded' : 'peek');
    track('sheet_toggle', { state: sheetState });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHAPTER WIDGET WIRING — molecules · ROI slider · products · dosage
  // Called after each renderChapter() so freshly-injected DOM gets bound.
  // ═══════════════════════════════════════════════════════════════
  function wireChapterWidgets(ch) {
    // ROI slider — live recalculation
    const roi = document.getElementById('roi-input');
    if (roi) {
      const updateRoi = () => {
        const svc = parseInt(roi.value, 10);
        // Base: $150/service × 52 weeks
        // Compounding multipliers (retail attach × referral lift)
        const base    = svc * 150 * 52;
        const retail  = Math.round(base * 0.25);          // 25% attach
        const lift    = Math.round((base + retail) * 0.30); // 30% lift on base + retail
        const annual  = base + retail + lift;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('roi-svc',    svc);
        set('roi-base',   '$' + base.toLocaleString());
        set('roi-retail', '$' + retail.toLocaleString());
        set('roi-lift',   '$' + lift.toLocaleString());
        set('roi-amount', '$' + annual.toLocaleString());
        // Store last values on the widget for export
        const w = document.querySelector('.roi-widget');
        if (w) {
          w.dataset.svc    = svc;
          w.dataset.base   = base;
          w.dataset.retail = retail;
          w.dataset.lift   = lift;
          w.dataset.annual = annual;
        }
      };
      roi.addEventListener('input', updateRoi);
      updateRoi();
    }

    // Product carousel scroll tracking + dot sync + dot tap-to-jump
    const carousel = document.getElementById('product-carousel');
    if (carousel) {
      const slides = carousel.querySelectorAll('.product-slide');
      const dots = document.querySelectorAll('.carousel-dot');
      const setActive = (idx) => {
        idx = Math.max(0, Math.min(idx, slides.length - 1));
        slides.forEach((s, i) => s.classList.toggle('active', i === idx));
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      };
      carousel.addEventListener('scroll', () => {
        const slideWidth = slides[0]?.offsetWidth || 1;
        const idx = Math.round(carousel.scrollLeft / slideWidth);
        setActive(idx);
      }, { passive: true });
      // Dot tap → animate to slide.
      // Two traps we had to avoid:
      //   1. `scrollTo({behavior:'smooth'})` is a silent no-op on elements
      //      with scroll-snap-type: mandatory (Chrome + Safari).
      //   2. Per-frame scrollLeft assignment with snap enabled makes every
      //      frame snap back to the nearest point — the animation never moves.
      // Solution: scrollIntoView on the target slide. Native, respects
      // scroll-snap, smooth-scrolls via CSS scroll-behavior without the
      // scrollTo bug, and works in hidden/background tabs where rAF is
      // throttled.
      dots.forEach((dot) => {
        dot.addEventListener('click', () => {
          const idx = parseInt(dot.dataset.carouselJump, 10);
          const target = slides[idx];
          if (!target) return;
          // Try native smooth scroll first. In a hidden/background tab,
          // rAF is throttled so smooth does nothing — fall back to instant
          // so the position is still correct when the tab comes back.
          const canSmooth = document.visibilityState === 'visible';
          target.scrollIntoView({
            inline: 'start',
            block: 'nearest',
            behavior: canSmooth ? 'smooth' : 'instant'
          });
          setActive(idx);
          if (navigator.vibrate) navigator.vibrate(6);
        });
      });
    }

    // Chair matte-charcoal override disabled — the new golden-chair.glb
    // ships with its own textured gold+black materials; don't overwrite them.
    const chair = document.getElementById('stage-chair');
    if (chair) {
      // (intentionally no material override)
      setTimeout(() => {
        // no-op retained to preserve surrounding timing
      }, 800);
    }
  }

  // ── Dosage map (chapter 6) ───────────────────────────────────
  const DOSAGE_MAP = {
    fine:   { pumps: 1, work: '15s', diffuse: '5m' },
    medium: { pumps: 3, work: '20s', diffuse: '6m' },
    coarse: { pumps: 4, work: '30s', diffuse: '8m' },
  };
  function applyDosage(coarseness) {
    const v = DOSAGE_MAP[coarseness];
    if (!v) return;
    document.querySelectorAll('.dosage-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.coarseness === coarseness);
    });
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('dose-pumps',   v.pumps);
    set('dose-work',    v.work);
    set('dose-diffuse', v.diffuse);
    if (navigator.vibrate) navigator.vibrate(8);
  }

  // ── Molecule click handler (chapter 3) ───────────────────────
  function onMoleculeClick(id) {
    const ch = CHAPTERS[currentChapter];
    const mol = ch.molecules?.find(m => m.id === id);
    if (!mol) return;
    document.querySelectorAll('.molecule-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.mol === id);
    });
    const detail = document.getElementById('mol-detail');
    if (detail) {
      detail.innerHTML = `
        <p class="mol-detail-name"><strong>${mol.name}</strong> · <span class="mol-detail-pct">${mol.weight} of formula</span></p>
        <p class="mol-detail-fn">${mol.function}</p>
        <p class="mol-detail-bond"><em>Bonds to:</em> ${mol.bondsTo}</p>
        <p class="mol-detail-source">${mol.source}</p>
      `;
    }
    if (navigator.vibrate) navigator.vibrate(8);
    track('molecule_tap', { id });
  }

  // ── Product info click handler (chapter 5) ───────────────────
  // Map product IDs to the 3D model-viewer slots in the lineup stage
  const PRODUCT_MODEL_MAP = {
    'conditioner':  { slot: 'l', src: 'assets/conditioner-new.glb' },
    'magic-spell':  { slot: 'c', src: 'assets/bottle-opt.glb' },
    'curl-cream':   { slot: 'r', src: 'assets/cream-new.glb' },
  };

  function onProductInfoClick(id) {
    const ch = CHAPTERS[currentChapter];
    const p = ch.products?.find(x => x.id === id);
    if (!p) return;
    // Locked products are inert until the stylist is certified
    if (p.tier === 'locked' && !isSystemUnlocked()) {
      showToast('Get certified to unlock the full system');
      if (navigator.vibrate) navigator.vibrate([4, 40, 4]);
      return;
    }

    // Highlight the matching card
    document.querySelectorAll('.product-slide').forEach(c => {
      c.classList.toggle('active', c.dataset.productInfo === id);
    });

    // Highlight the matching 3D bottle in the lineup stage (if it exists).
    // When selection has no 3D match, leave all bottles lit — do NOT dim all,
    // otherwise the user thinks the carousel broke.
    const mapping = PRODUCT_MODEL_MAP[id];
    document.querySelectorAll('.lineup-slot').forEach(slot => {
      if (!mapping) {
        slot.classList.remove('highlighted', 'dimmed');
        return;
      }
      const isMatch = slot.classList.contains('lineup-slot-' + mapping.slot);
      slot.classList.toggle('highlighted', isMatch);
      slot.classList.toggle('dimmed', !isMatch);
    });

    selectedProductId = id;
    if (navigator.vibrate) navigator.vibrate(8);
    track('product_info_tap', { id });
  }

  function nextChapter() {
    // Explicit: if the current chapter is a form chapter, the CTA submits.
    // Otherwise advance. Final chapter with no form field is a no-op.
    const ch = CHAPTERS[currentChapter];
    if (ch?.formField) {
      submitContact();
      return;
    }
    // Quiz gate: ch6 → ch7 requires passing the 2-question quiz first.
    // (ch6 is the "application" chapter; ch7 is "certified".)
    if (ch?.id === 'application' && !quizPassed) {
      showQuizGate();
      return;
    }
    if (currentChapter < CHAPTERS.length - 1) {
      renderChapter(currentChapter + 1);
    }
  }

  function prevChapter() {
    if (currentChapter > 0) renderChapter(currentChapter - 1);
  }

  function restartExperience() {
    track('restart');
    if (navigator.vibrate) navigator.vibrate([6, 20, 6]);
    // Reset per-session state so the next stylist starts clean
    selectedProductId = 'magic-spell';
    quizPassed = false;
    // Clear any open overlays
    document.querySelectorAll('#salon-modal, #ar-unsupported-modal, #roi-modal, #quiz-modal').forEach(m => m.remove());
    renderChapter(0);
  }

  // ═══════════════════════════════════════════════════════════════
  // QUIZ GATE — earns the "Certified" word before chapter 7
  // ───────────────────────────────────────────────────────────────
  // Two questions, one from the formula chapter, one from the
  // application chapter. The stylist must pick the right answer for
  // both before Curl Cult trusts them with the credential.
  // ═══════════════════════════════════════════════════════════════
  const QUIZ = [
    {
      q: 'Which molecule rebuilds broken bonds?',
      options: [
        { id: 'keratin', label: 'Hydrolyzed Keratin', correct: true },
        { id: 'silk',    label: 'Silk Protein',       correct: false },
        { id: 'argan',   label: 'Argan Oil',          correct: false },
      ],
    },
    {
      q: 'Coarse hair — how many pumps of Magic Spell?',
      options: [
        { id: '1', label: '1 pump',  correct: false },
        { id: '3', label: '3 pumps', correct: false },
        { id: '4', label: '4 pumps', correct: true },
      ],
    },
  ];

  function showQuizGate() {
    track('quiz_open');
    document.getElementById('quiz-modal')?.remove();
    const state = { answers: new Array(QUIZ.length).fill(null), step: 0 };

    const render = () => {
      const q = QUIZ[state.step];
      const progress = QUIZ.map((_, i) => `<span class="quiz-dot${i < state.step ? ' done' : i === state.step ? ' active' : ''}"></span>`).join('');
      modal.innerHTML = `
        <div class="salon-modal-inner quiz-inner">
          <button class="salon-modal-close" data-card-close aria-label="Close">×</button>
          <p class="salon-modal-eyebrow">— Prove it</p>
          <div class="quiz-progress" aria-hidden="true">${progress}</div>
          <h3 class="quiz-q">${q.q}</h3>
          <div class="quiz-options">
            ${q.options.map((o, i) => `
              <button type="button" class="quiz-option" data-quiz-opt="${i}">${o.label}</button>
            `).join('')}
          </div>
          <p class="quiz-hint" id="quiz-hint">Pick one.</p>
        </div>
      `;
      modal.querySelectorAll('[data-quiz-opt]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.quizOpt, 10);
          const opt = q.options[idx];
          modal.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('is-wrong','is-right'));
          if (!opt.correct) {
            btn.classList.add('is-wrong');
            modal.querySelector('#quiz-hint').textContent = 'Not quite. Try again.';
            if (navigator.vibrate) navigator.vibrate([4, 40, 4]);
            try { window.cc && cc.deny(); } catch (_) {}
            return;
          }
          btn.classList.add('is-right');
          state.answers[state.step] = opt.id;
          if (navigator.vibrate) navigator.vibrate(12);
          try { window.cc && cc.confirm(); } catch (_) {}
          setTimeout(() => {
            state.step++;
            if (state.step < QUIZ.length) {
              render();
            } else {
              quizPassed = true;
              track('quiz_pass');
              modal.remove();
              renderChapter(6); // chapter 7 (certified)
            }
          }, 420);
        });
      });
    };

    const modal = document.createElement('div');
    modal.id = 'quiz-modal';
    modal.className = 'salon-modal';
    document.body.appendChild(modal);
    render();
    if (navigator.vibrate) navigator.vibrate([10, 20, 10]);
  }

  // Lightweight toast (auto-dismisses). Used for soft denials like
  // tapping a locked product before certification.
  function showToast(msg) {
    const existing = document.getElementById('cc-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'cc-toast';
    el.className = 'cc-toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    // Trigger enter animation
    requestAnimationFrame(() => el.classList.add('is-visible'));
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  function jumpToChapter(index) {
    if (index < 0 || index >= CHAPTERS.length) return;
    if (index === currentChapter) return;
    track('chapter_jump', { from: currentChapter, to: index });
    renderChapter(index);
  }

  function sendTextMeLink() {
    const input = $('#textme-input');
    const fb = $('#textme-feedback');
    if (!input || !fb) return;
    const raw = input.value.trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      fb.textContent = 'Check the phone number';
      fb.style.color = '#ff8a8a';
      return;
    }
    // Store locally for kiosk analytics / follow-up
    try {
      const saved = JSON.parse(localStorage.getItem('curlcult_textme') || '[]');
      saved.push({ phone: raw, ts: Date.now() });
      localStorage.setItem('curlcult_textme', JSON.stringify(saved.slice(-100)));
    } catch (_) {}
    track('textme_sent', { digits: digits.length });
    // Hand off to the native SMS composer with the URL pre-filled.
    // Body-encoding differs between iOS (? separator) and Android (& or ?).
    // Modern iOS accepts `sms:NUMBER&body=...` — we use that.
    const url = location.origin + location.pathname;
    const body = encodeURIComponent(`Your Curl Cult experience: ${url}`);
    const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
    const href = isIOS
      ? `sms:${digits}&body=${body}`
      : `sms:${digits}?body=${body}`;
    fb.textContent = '✓ Opening Messages…';
    fb.style.color = '#E89B7F';
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    // Slight delay so the feedback renders before the native sheet
    setTimeout(() => { window.location.href = href; }, 150);
  }

  function submitContact() {
    const input = $('#contact-input');
    const feedback = $('#form-feedback');
    if (!input || !feedback) return;

    const v = input.value.trim();
    // ASCII-only email: local part + @ + domain (letters/digits/dots/hyphens)
    // + TLD of 2+ letters. Rejects emoji, Unicode tricks, bare strings.
    const emailRe = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
    // Phone: extract digits only and require 7–15 of them (E.164 max).
    const phoneDigits = v.replace(/\D/g, '');
    const phoneValid  = /^[\d\s\-+().]+$/.test(v) && phoneDigits.length >= 7 && phoneDigits.length <= 15;

    if (!v) { feedback.textContent = 'Enter an email or phone'; feedback.style.color = '#ff5d5d'; return; }
    if (!emailRe.test(v) && !phoneValid) { feedback.textContent = 'Check the format'; feedback.style.color = '#ff5d5d'; return; }

    try {
      const saved = JSON.parse(localStorage.getItem('curlcult_contacts') || '[]');
      saved.push({ value: v, ts: Date.now() });
      localStorage.setItem('curlcult_contacts', JSON.stringify(saved));
    } catch (_) {}

    feedback.textContent = 'Link on the way';
    feedback.style.color = '#E89B7F';
    input.value = '';
    track('contact_captured', { value: v });
    if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT WIRING
  // ═══════════════════════════════════════════════════════════════
  function wireEvents() {
    $('#btn-begin').addEventListener('click', beginSession);

    document.addEventListener('click', (e) => {
      // Sheet handle — toggle peek/expanded
      if (e.target.closest('.sheet-handle')) {
        e.preventDefault();
        toggleSheetState();
        return;
      }
      if (e.target.closest('[data-next]'))  { e.preventDefault(); nextChapter(); }
      if (e.target.closest('[data-prev]'))  { e.preventDefault(); prevChapter(); }
      if (e.target.closest('[data-restart]')) { e.preventDefault(); restartExperience(); }
      const jumpBtn = e.target.closest('[data-jump]');
      if (jumpBtn) {
        e.preventDefault();
        jumpToChapter(parseInt(jumpBtn.dataset.jump, 10));
      }
      if (e.target.closest('[data-ar-place]')) {
        e.preventDefault();
        if (navigator.vibrate) navigator.vibrate([12, 30, 12]);
        activateChapterAR();
      }

      const pill = e.target.closest('[data-product]');
      if (pill) {
        const id = pill.getAttribute('data-product');
        selectedProductId = id;
        track('product_selected', { id });
        renderChapter(5);
      }

      // Molecule chip tap (chapter 3)
      const molBtn = e.target.closest('[data-mol]');
      if (molBtn) {
        e.preventDefault();
        onMoleculeClick(molBtn.dataset.mol);
      }

      // Product info card tap (chapter 5 system)
      const prodInfoBtn = e.target.closest('[data-product-info]');
      if (prodInfoBtn) {
        e.preventDefault();
        onProductInfoClick(prodInfoBtn.dataset.productInfo);
      }

      // Dosage pill tap (chapter 6)
      const dosePill = e.target.closest('[data-coarseness]');
      if (dosePill) {
        e.preventDefault();
        applyDosage(dosePill.dataset.coarseness);
      }
      if (e.target.closest('[data-roi-save]')) {
        e.preventDefault();
        showRoiCard();
      }
      // 3D hotspot tap — expand the label, collapse any others on
      // the same model-viewer. Tapping an already-open hotspot closes it.
      const hotspot = e.target.closest('.hotspot');
      if (hotspot) {
        e.preventDefault();
        const mv = hotspot.closest('model-viewer');
        const wasOpen = hotspot.classList.contains('is-open');
        if (mv) mv.querySelectorAll('.hotspot.is-open').forEach(h => h.classList.remove('is-open'));
        if (!wasOpen) {
          hotspot.classList.add('is-open');
          if (navigator.vibrate) navigator.vibrate(6);
          try { window.cc && cc.tap(); } catch (_) {}
          track('hotspot_open', { key: hotspot.dataset.hotspotKey });
        }
        return;
      }
      // Click on stage outside a hotspot → close any open ones
      if (e.target.closest('model-viewer')) {
        document.querySelectorAll('.hotspot.is-open').forEach(h => h.classList.remove('is-open'));
      }
      if (e.target.closest('[data-card-close]')) {
        document.querySelectorAll('#salon-modal, #ar-unsupported-modal, #roi-modal').forEach(m => m.remove());
      }
    });

    document.addEventListener('keydown', (e) => {
      // Contact input submits on Enter
      if (e.target?.id === 'contact-input' && e.key === 'Enter') {
        e.preventDefault();
        submitContact();
        return;
      }
      // Global navigation — only active once the session has started
      if (!sessionStarted) {
        if (e.key === 'Enter' || e.key === ' ') {
          const btn = $('#btn-begin');
          if (btn && !btn.disabled) { e.preventDefault(); beginSession(); }
        }
        return;
      }
      // Ignore modifier-bearing shortcuts — let the browser have them
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Ignore if typing in any input/textarea
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

      // If any overlay modal is open, only Escape is honored — everything
      // else is trapped so chapter nav doesn't leak through the overlay.
      const openModal = document.querySelector('#salon-modal, #ar-unsupported-modal');
      if (openModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          openModal.remove();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault(); nextChapter(); break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault(); prevChapter(); break;
        case 'r':
        case 'R':
          e.preventDefault(); restartExperience(); break;
        case 'm':
        case 'M':
          e.preventDefault(); setVoMuted(!voMuted); break;
        case 'Escape':
          // No modal was open (handled above) — peek the sheet
          if (sheetState !== 'peek') toggleSheetState();
          break;
        default:
          // Number keys 1..9 jump to that chapter
          if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            jumpToChapter(parseInt(e.key, 10) - 1);
          }
      }
    });

    $('#debug-toggle')?.addEventListener('click', () => {
      $('#debug-console').classList.toggle('visible');
      $('#debug-toggle').classList.remove('has-errors');
    });

    // VO mute toggle
    $('#vo-mute')?.addEventListener('click', () => {
      setVoMuted(!voMuted);
      if (navigator.vibrate) navigator.vibrate(8);
    });
    // Reflect initial state
    const muteBtn = document.getElementById('vo-mute');
    if (muteBtn) muteBtn.dataset.muted = voMuted ? 'true' : 'false';
    $('#debug-close')?.addEventListener('click', () => {
      $('#debug-console').classList.remove('visible');
    });

    // Demo mode: auto-begin once preload is done + optional ?start=N jump
    if (location.search.includes('demo=1')) {
      const tryBegin = () => {
        if (!preloadComplete) {
          setTimeout(tryBegin, 200);
          return;
        }
        debug.log('Demo mode · auto-begin');
        beginSession();
        const startMatch = location.search.match(/start=(\d+)/);
        if (startMatch) {
          const startIdx = Math.max(0, Math.min(parseInt(startMatch[1], 10) - 1, CHAPTERS.length - 1));
          setTimeout(() => renderChapter(startIdx), 200);
        }
      };
      setTimeout(tryBegin, 200);
    }

    // Tour mode: ?tour=1 auto-advances through chapters for a passive
    // booth display (tablet on easel, walk-by attraction). Each chapter
    // holds for ~10s with a subtle progress bar. User tap pauses.
    if (location.search.includes('tour=1')) {
      startTourMode();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TOUR MODE — autoplay the experience for a booth display
  // ───────────────────────────────────────────────────────────────
  // Stylists walking past the booth see the app cycle through on a
  // tablet without anyone touching it. Progress bar telegraphs timing;
  // tapping pauses and hands control back.
  // ═══════════════════════════════════════════════════════════════
  function startTourMode() {
    const DURATION_MS = 10000; // per chapter
    let timer = null;
    let paused = false;
    let tourActive = true;

    const startBegin = () => {
      if (!preloadComplete) return setTimeout(startBegin, 200);
      beginSession().then(() => { document.body.classList.add('tour-mode'); kickProgress(); });
    };
    setTimeout(startBegin, 200);

    // Progress element injected once the session begins
    const ensureProgressEl = () => {
      let el = document.getElementById('tour-progress');
      if (el) return el;
      el = document.createElement('div');
      el.id = 'tour-progress';
      el.className = 'tour-progress';
      el.innerHTML = `
        <span class="tour-progress-fill"></span>
        <button type="button" class="tour-exit" aria-label="Exit tour">Stop tour</button>
      `;
      document.body.appendChild(el);
      el.querySelector('.tour-exit').addEventListener('click', exitTour);
      return el;
    };

    const kickProgress = () => {
      if (!tourActive) return;
      const el = ensureProgressEl();
      const fill = el.querySelector('.tour-progress-fill');
      // Reset the bar, then animate over DURATION_MS
      fill.style.transition = 'none';
      fill.style.transform = 'scaleX(0)';
      void fill.offsetWidth;
      fill.style.transition = `transform ${DURATION_MS}ms linear`;
      fill.style.transform = 'scaleX(1)';
      clearTimeout(timer);
      timer = setTimeout(advance, DURATION_MS);
    };

    const advance = () => {
      if (!tourActive || paused) return;
      if (currentChapter < CHAPTERS.length - 1) {
        renderChapter(currentChapter + 1);
        kickProgress();
      } else {
        // Loop back to landing after the final chapter
        restartExperience();
        kickProgress();
      }
    };

    const exitTour = () => {
      tourActive = false;
      paused = true;
      clearTimeout(timer);
      document.body.classList.remove('tour-mode');
      document.getElementById('tour-progress')?.remove();
      track('tour_exit');
    };

    // Pause on any user interaction with the sheet/stage
    const pauseOnInteract = () => {
      if (!tourActive || paused) return;
      paused = true;
      clearTimeout(timer);
      const fill = document.querySelector('#tour-progress .tour-progress-fill');
      if (fill) {
        const rect = fill.getBoundingClientRect();
        const parentRect = fill.parentElement.getBoundingClientRect();
        fill.style.transition = 'none';
        fill.style.transform = `scaleX(${rect.width / parentRect.width})`;
      }
      track('tour_pause');
    };
    document.addEventListener('click', (e) => {
      // Don't pause if the user clicks the exit button itself
      if (!tourActive) return;
      if (e.target.closest('.tour-exit')) return;
      pauseOnInteract();
    }, true);

    track('tour_start');
  }

  // ═══════════════════════════════════════════════════════════════
  // DRACO DECODER — critical for loading the compressed GLBs
  // ═══════════════════════════════════════════════════════════════
  function configureModelViewer() {
    const tryConfigure = () => {
      const mvClass = customElements.get('model-viewer');
      if (!mvClass) { setTimeout(tryConfigure, 100); return; }
      mvClass.dracoDecoderLocation = 'assets/draco/';
      debug.log('Draco decoder → assets/draco/');
    };
    tryConfigure();
  }

  // ═══════════════════════════════════════════════════════════════
  // MATERIAL OVERRIDES (ported from SPA) — chair matte black + bottle label cleanup
  // ═══════════════════════════════════════════════════════════════
  function applyChairMatteBlackMaterialWithRetry(mv, attempt = 0) {
    const materials = mv?.model?.materials || [];
    if (!materials.length) {
      if (attempt < 20) setTimeout(() => applyChairMatteBlackMaterialWithRetry(mv, attempt + 1), 120);
      return;
    }
    applyChairMatteBlackMaterial(mv);
  }

  function applyChairMatteBlackMaterial(mv) {
    const materials = mv?.model?.materials || [];
    materials.forEach((material) => {
      const pbr = material?.pbrMetallicRoughness;
      if (!pbr) return;
      try {
        if (pbr.baseColorTexture && pbr.baseColorTexture.setTexture) {
          pbr.baseColorTexture.setTexture(null);
        }
      } catch (_) {}
      pbr.setBaseColorFactor([0.05, 0.05, 0.06, 1]);
      pbr.setMetallicFactor(0.0);
      pbr.setRoughnessFactor(0.9);
      try { material.setEmissiveFactor && material.setEmissiveFactor([0, 0, 0]); } catch (_) {}
    });
    mv.removeAttribute('environment-image');
    mv.setAttribute('exposure', '0.6');
    mv.setAttribute('shadow-intensity', '1.4');
    debug.log(`Chair matte applied · ${materials.length} mats`);
  }

  // Keep only the flying butterflies, hide the ones sitting on flowers.
  // User feedback: B_1_M, B_12_M, lambert10 were the SITTING ones (my
  // earlier guess was inverted). The actual flying cluster is B_6_M
  // (shared across 6 mesh instances — that's the loose mid-air cloud).
  //
  // KEEP: B_6_M only → 6 butterflies flying through the air.
  // This is one more than "3-4" but they're spread across the scene so
  // it reads as a natural cluster rather than a swarm.
  function hideMostButterflies(mv, attempt = 0) {
    const materials = mv?.model?.materials || [];
    if (!materials.length) {
      if (attempt < 30) setTimeout(() => hideMostButterflies(mv, attempt + 1), 150);
      return;
    }
    const KEEP = new Set(['b_6_m']);
    const BUTTERFLY_MATCH = /^(b_\d+_m|lambert\d+)$/i;
    let hidden = 0, kept = 0;
    materials.forEach((material) => {
      const name = (material.name || '').toLowerCase();
      if (!BUTTERFLY_MATCH.test(name)) return; // leave scenery alone
      if (KEEP.has(name)) { kept++; return; }
      const pbr = material.pbrMetallicRoughness;
      if (!pbr) return;
      try {
        if (pbr.baseColorTexture && pbr.baseColorTexture.setTexture) {
          pbr.baseColorTexture.setTexture(null);
        }
        pbr.setBaseColorFactor([0, 0, 0, 0]);
        material.setAlphaMode && material.setAlphaMode('BLEND');
        hidden++;
      } catch (e) {
        debug.warn(`Butterfly hide failed on ${name}: ${e.message}`);
      }
    });
    debug.log(`Garden butterflies reduced · ${hidden} mats hidden, ${kept} kept`);
  }

  // Hide the ground plane, ferns, and pink flower from the butterflies
  // GLB so only the animated butterflies themselves are visible. Works
  // by zeroing-out the alpha on scenery materials via PBR overrides.
  function hideButterfliesScenery(mv, attempt = 0) {
    const materials = mv?.model?.materials || [];
    if (!materials.length) {
      if (attempt < 30) setTimeout(() => hideButterfliesScenery(mv, attempt + 1), 150);
      return;
    }
    // Known scenery material names from the GLB inspection:
    //   PinkFlower, Fern_Alfa, Fern_D, Ground
    // Butterflies are named B_1_M..B_12_M + lambert9/10/15 — keep them.
    const SCENERY_MATCH = /^(pinkflower|fern_?|ground)/i;
    let hidden = 0;
    materials.forEach((material) => {
      const name = (material.name || '').toLowerCase();
      if (!SCENERY_MATCH.test(name)) return;
      const pbr = material.pbrMetallicRoughness;
      if (!pbr) return;
      try {
        // Strip texture so only the alpha factor shows through
        if (pbr.baseColorTexture && pbr.baseColorTexture.setTexture) {
          pbr.baseColorTexture.setTexture(null);
        }
        // Fully transparent
        pbr.setBaseColorFactor([0, 0, 0, 0]);
        pbr.setMetallicFactor(0);
        pbr.setRoughnessFactor(1);
        material.setAlphaMode && material.setAlphaMode('BLEND');
        material.setEmissiveFactor && material.setEmissiveFactor([0, 0, 0]);
        hidden++;
      } catch (e) {
        debug.warn(`Butterfly scenery hide failed on ${name}: ${e.message}`);
      }
    });
    debug.log(`Butterflies scenery hidden · ${hidden}/${materials.length} mats`);
  }

  function applyCleanLabelMaterial(mv) {
    const materials = mv?.model?.materials || [];
    if (!materials.length) {
      setTimeout(() => applyCleanLabelMaterial(mv), 120);
      return;
    }
    materials.forEach((material) => {
      const pbr = material?.pbrMetallicRoughness;
      if (!pbr) return;
      try {
        const cur = pbr.baseColorFactor || [1, 1, 1, 1];
        const brightness = (cur[0] + cur[1] + cur[2]) / 3;
        if (brightness > 0.35) {
          pbr.setBaseColorFactor([0.78, 0.72, 0.60, 1]);
          pbr.setRoughnessFactor(0.6);
          pbr.setMetallicFactor(0.04);
        } else {
          const g = (cur[0] + cur[1] + cur[2]) / 3;
          pbr.setBaseColorFactor([g * 0.9, g * 0.9, g * 0.95, 1]);
          pbr.setRoughnessFactor(0.5);
          pbr.setMetallicFactor(0.15);
        }
      } catch (_) {}
    });
    debug.log(`Clean-label applied · ${materials.length} mats`);
  }

  // ═══════════════════════════════════════════════════════════════
  // VOICEOVER ENGINE — captions + per-chapter audio + mute toggle
  // ───────────────────────────────────────────────────────────────
  // Each chapter has a `caption` (text) and a `voClip` (audio URL).
  // - The caption fades in on chapter change regardless of audio
  // - If the voClip exists AND the user hasn't muted, audio plays
  // - Mute state persists in localStorage so the user opts in once
  // - When real green-screen audio lands, the system picks it up
  //   automatically without code changes
  // ═══════════════════════════════════════════════════════════════
  let voAudio = null;
  let voMuted = (() => {
    // Default: UNMUTED. First-time users should hear Janine's voice.
    // We only treat it as muted if the user has explicitly set '1' before.
    try { return localStorage.getItem('cc_vo_muted') === '1'; } catch (_) { return false; }
  })();

  function setVoMuted(muted) {
    voMuted = !!muted;
    try { localStorage.setItem('cc_vo_muted', voMuted ? '1' : '0'); } catch (_) {}
    const btn = document.getElementById('vo-mute');
    if (btn) {
      btn.dataset.muted = voMuted ? 'true' : 'false';
      // Keep aria-label + title in sync so screen readers + tooltips reflect state
      const label = voMuted ? 'Unmute sound' : 'Mute sound';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label + ' (m)');
      btn.setAttribute('aria-pressed', voMuted ? 'true' : 'false');
    }
    if (voMuted && voAudio) {
      voAudio.pause();
    } else if (!voMuted && voAudio && voAudio.paused) {
      voAudio.play().catch(() => {});
    }
    // Also control UI sound effects + ambient bed
    try { window.cc && cc.setEnabled(!voMuted); } catch (_) {}
    track('vo_mute_toggle', { muted: voMuted });
  }

  function renderVoCaption(ch) {
    // Caption banner removed — headline + body in the sheet already
    // shows the same line. Function kept so the call site doesn't break.
    void ch;
  }

  function playVoForChapter(ch) {
    // Always stop the previous audio
    if (voAudio) {
      try { voAudio.pause(); } catch (_) {}
      voAudio = null;
    }
    if (!ch.voClip) return;
    // Pre-create the audio element. If the file 404s (it will until
    // recordings land), we fail silently — caption still shows.
    voAudio = new Audio(ch.voClip);
    voAudio.preload = 'auto';
    const thisAudio = voAudio; // stable reference for the canplay handler
    voAudio.addEventListener('error', () => {
      debug.log(`VO clip not yet recorded: ${ch.voClip}`);
      if (voAudio === thisAudio) voAudio = null;
    });
    voAudio.addEventListener('canplay', () => {
      if (voAudio !== thisAudio) return; // stale clip — chapter changed
      debug.log(`VO ready: ${ch.voClip}`);
      if (voMuted) return;
      thisAudio.play().catch((e) => {
        debug.warn(`VO play blocked: ${e.message}`);
        // iOS Safari autoplay blocked — prompt the user once with a toast
        // so they know to tap the VO button.
        if (!sessionStorage.getItem('cc_vo_prompted')) {
          showToast('Tap 🔊 to hear Janine');
          sessionStorage.setItem('cc_vo_prompted', '1');
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SALON CARD — closing moment shareable PNG
  // ───────────────────────────────────────────────────────────────
  // Generates a 1080×1350 (Instagram post) PNG combining:
  //  · CURL CULT wordmark
  //  · A frozen frame from the live camera
  //  · The user's "Stylist Profile" — derived from their lineup pick
  //  · A unique stylist ID + today's date
  //  · curlcult.com sign-off
  // Then offers native share or PNG download.
  // ═══════════════════════════════════════════════════════════════

  const PRODUCT_DETAILS = {
    'magic-spell': {
      name:    'Magic Spell',
      tagline: 'Prep · Protect · Perform',
      profile: 'The Hydration Architect',
    },
    'conditioner': {
      name:    'Hydrating Conditioner',
      tagline: 'Weightless hydration · Deep repair',
      profile: 'The Restoration Specialist',
    },
    'curl-cream': {
      name:    'Curl Cream',
      tagline: 'Definition without the crunch',
      profile: 'The Curl Sculptor',
    },
    'leave-in': {
      name:    'Leave-In Mist',
      tagline: 'Day-two refresh · Never sticky',
      profile: 'The Revival Artist',
    },
    'protein-mask': {
      name:    'Protein Mask',
      tagline: 'Bond repair · Weekly reset',
      profile: 'The Bond Builder',
    },
    'oil': {
      name:    'Finishing Oil',
      tagline: 'Shine seal · Heat guard',
      profile: 'The Finish Stylist',
    },
    'gel': {
      name:    'Definition Gel',
      tagline: 'Cast hold · Crunch-proof',
      profile: 'The Coil Engineer',
    },
    'cleanser': {
      name:    'Co-Cleanser',
      tagline: 'Low-poo · High-clarity',
      profile: 'The Clean-Slate Specialist',
    },
  };

  function generateStylistId() {
    // Deterministic-ish 4-char ID based on session
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  // Cache the stylist ID once per session so re-generations don't change it
  let cachedStylistId = null;
  function getStylistId() {
    if (!cachedStylistId) cachedStylistId = generateStylistId();
    return cachedStylistId;
  }

  // Load the SVG logo once and cache as an HTMLImageElement
  let cachedLogoImg = null;
  function loadLogo() {
    if (cachedLogoImg) return Promise.resolve(cachedLogoImg);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { cachedLogoImg = img; resolve(img); };
      img.onerror = reject;
      img.src = 'assets/logo.svg';
    });
  }

  // Rounded-rect helper for image clipping + strokes
  function roundedRectPath(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  async function generateSalonCard() {
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── 1. Background — deep black + warm glow anchored at the bottom ──
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, W, H);

    const radial = ctx.createRadialGradient(W / 2, H * 0.78, 0, W / 2, H * 0.78, W * 0.95);
    radial.addColorStop(0,    'rgba(232, 155, 127, 0.18)');
    radial.addColorStop(0.5,  'rgba(232, 155, 127, 0.05)');
    radial.addColorStop(1,    'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);

    // Very subtle grain for texture
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 600; i++) {
      const gx = Math.random() * W;
      const gy = Math.random() * H;
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.globalAlpha = 1;

    // ── 2. Single wordmark up top, quieter and tighter ──
    const PAD_X = 80;
    const TOP_Y = 90;
    let wordmarkBottomY = TOP_Y + 60;
    try {
      const logo = await loadLogo();
      const logoW = 260;
      const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW;
      ctx.save();
      ctx.filter = 'invert(1) brightness(1.1)';
      ctx.drawImage(logo, (W - logoW) / 2, TOP_Y, logoW, logoH);
      ctx.restore();
      wordmarkBottomY = TOP_Y + logoH;
    } catch (e) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 56px "Geist", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CURL CULT', W / 2, TOP_Y + 48);
      wordmarkBottomY = TOP_Y + 60;
    }

    // ── 3. Rounded photo plate — no corner ticks, just a soft plate ──
    // Budget the layout top-down so the profile block always has room:
    //   wordmark + 60 gap → photo → 100 gap → profile (~210) → 140 bottom
    const FRAME_X = PAD_X;
    const FRAME_W = W - PAD_X * 2;
    const FRAME_Y = Math.round(wordmarkBottomY + 60);
    const bottomBudget = 100 + 220 + 140 + 24; // gap + profile + bottom row + breath
    const FRAME_H = Math.round(Math.min(FRAME_W * 0.92, H - FRAME_Y - bottomBudget));
    const FRAME_R = 28;

    const video = document.getElementById('cam-feed');
    const haveVideo = video && video.videoWidth > 0 && video.readyState >= 2;

    // Clip to rounded rect
    ctx.save();
    roundedRectPath(ctx, FRAME_X, FRAME_Y, FRAME_W, FRAME_H, FRAME_R);
    ctx.clip();

    if (haveVideo) {
      const vAspect = video.videoWidth / video.videoHeight;
      const fAspect = FRAME_W / FRAME_H;
      let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
      if (vAspect > fAspect) {
        sw = video.videoHeight * fAspect;
        sx = (video.videoWidth - sw) / 2;
      } else {
        sh = video.videoWidth / fAspect;
        sy = (video.videoHeight - sh) / 2;
      }
      ctx.drawImage(video, sx, sy, sw, sh, FRAME_X, FRAME_Y, FRAME_W, FRAME_H);
      // Soft darkening gradient toward bottom so name below has breathing room
      const g = ctx.createLinearGradient(0, FRAME_Y, 0, FRAME_Y + FRAME_H);
      g.addColorStop(0,   'rgba(0,0,0,0.15)');
      g.addColorStop(0.55,'rgba(0,0,0,0)');
      g.addColorStop(1,   'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);
    } else {
      // Fallback: warm-to-black gradient plate
      const g = ctx.createLinearGradient(FRAME_X, FRAME_Y, FRAME_X, FRAME_Y + FRAME_H);
      g.addColorStop(0, '#1a0e0a');
      g.addColorStop(1, '#060606');
      ctx.fillStyle = g;
      ctx.fillRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);
      ctx.fillStyle = 'rgba(232,155,127,0.42)';
      ctx.font = '500 18px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Camera was off', W / 2, FRAME_Y + FRAME_H / 2 + 6);
    }
    ctx.restore();

    // Hairline around the photo for a crisp card edge
    ctx.save();
    roundedRectPath(ctx, FRAME_X + 0.5, FRAME_Y + 0.5, FRAME_W - 1, FRAME_H - 1, FRAME_R);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // ── 4. Profile section — bigger name, elegant signature ──
    const product = PRODUCT_DETAILS[selectedProductId] || PRODUCT_DETAILS['magic-spell'];
    const NAME_Y = FRAME_Y + FRAME_H + 110;

    // Tiny eyebrow — lowercase for calm confidence
    ctx.fillStyle = 'rgba(232, 155, 127, 0.75)';
    ctx.font = '500 18px "Geist Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('S T Y L I S T', W / 2, NAME_Y);

    // Name — large, tight tracking, sentence case
    ctx.fillStyle = '#f5f5f7';
    ctx.font = '600 78px "Geist", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    // Manual letter-spacing trick for canvas: kern by drawing slightly tighter
    ctx.fillText(product.profile, W / 2, NAME_Y + 80);

    // Signature line — peach accent, softer weight
    ctx.fillStyle = 'rgba(232, 155, 127, 0.95)';
    ctx.font = '400 26px "Geist", -apple-system, sans-serif';
    ctx.fillText(product.tagline || ('Signature · ' + product.name), W / 2, NAME_Y + 130);

    // ── 4b. Projected ROI badge if user touched the slider on ch4 ──
    const w = document.querySelector('.roi-widget');
    const projected = w ? parseInt(w.dataset.annual || '0', 10) : 0;
    if (projected > 0) {
      const badgeY = NAME_Y + 196;
      const badgeText = '+ $' + projected.toLocaleString() + ' / yr projected';
      ctx.font = '500 22px "Geist Mono", monospace';
      const tw = ctx.measureText(badgeText).width;
      const padX = 22, padY = 14;
      const bw = tw + padX * 2;
      const bh = 22 + padY * 2;
      const bx = (W - bw) / 2;
      const by = badgeY - bh / 2;
      ctx.save();
      roundedRectPath(ctx, bx, by, bw, bh, bh / 2);
      ctx.fillStyle = 'rgba(232, 155, 127, 0.12)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(232, 155, 127, 0.55)';
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(232, 155, 127, 0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, W / 2, by + bh / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    }

    // ── 5. Bottom ticket row — stylist ID · date · url, one clean line ──
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const stylistId = getStylistId();

    // Short hairline — centered, narrower
    const lineY = H - 138;
    const lineW = 120;
    ctx.strokeStyle = 'rgba(232, 155, 127, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo((W - lineW) / 2, lineY);
    ctx.lineTo((W + lineW) / 2, lineY);
    ctx.stroke();

    // ID + date on one line, centered, separated by dot
    ctx.fillStyle = 'rgba(134, 134, 139, 0.9)';
    ctx.font = '400 18px "Geist Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${stylistId}  ·  ${date}`, W / 2, H - 100);

    // URL — quiet watermark
    ctx.fillStyle = 'rgba(232, 155, 127, 0.8)';
    ctx.font = '500 18px "Geist Mono", monospace';
    ctx.fillText('curlcult.com', W / 2, H - 58);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
  }

  async function showSalonCard() {
    track('salon_card_open');
    debug.log('Generating salon card…');

    // Wait for fonts to be ready so canvas text uses Geist
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }

    const blob = await generateSalonCard();
    if (!blob) {
      debug.error('Salon card blob generation failed');
      return;
    }
    const url = URL.createObjectURL(blob);
    const file = new File([blob], `curl-cult-${getStylistId()}.png`, { type: 'image/png' });

    // Render a preview modal with the card + share + download buttons
    const existing = document.getElementById('salon-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'salon-modal';
    modal.className = 'salon-modal';
    modal.innerHTML = `
      <div class="salon-modal-inner">
        <button class="salon-modal-close" data-card-close aria-label="Close">×</button>
        <p class="salon-modal-eyebrow">— Your salon card</p>
        <img class="salon-modal-img" src="${url}" alt="Your Curl Cult salon card">
        <div class="salon-modal-actions">
          <button class="salon-share btn-primary" id="salon-share-btn"><span>${navigator.canShare && navigator.canShare({ files: [file] }) ? 'Share' : 'Save'}</span><span class="arrow">↗</span></button>
          <button class="btn-ghost" data-card-close>Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Wire share/download
    document.getElementById('salon-share-btn').addEventListener('click', async () => {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'My Curl Cult Stylist Card',
            text: 'I just got Curl Cult certified.',
          });
          track('salon_card_shared');
        } catch (e) {
          // Share canceled — fall back to download
          downloadBlob(url, file.name);
        }
      } else {
        downloadBlob(url, file.name);
        track('salon_card_downloaded');
      }
    });

    if (navigator.vibrate) navigator.vibrate([12, 30, 12]);
  }

  function downloadBlob(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }


  // ═══════════════════════════════════════════════════════════════
  // CAPTURE — photo + 5s video with brand overlay
  // ───────────────────────────────────────────────────────────────
  // The stylist's moment of arrival. Takes the live camera feed +
  // composites the CURL CULT wordmark + "CERTIFIED" stamp over it
  // and offers share or download.
  // ═══════════════════════════════════════════════════════════════
  function drawCertifiedOverlay(ctx, w, h) {
    // Bottom gradient for legibility
    const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Corner ticks for editorial feel
    const inset = Math.min(w, h) * 0.055;
    const tick = Math.min(w, h) * 0.04;
    ctx.strokeStyle = 'rgba(232, 155, 127, 0.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';
    // TL
    ctx.beginPath(); ctx.moveTo(inset, inset + tick); ctx.lineTo(inset, inset); ctx.lineTo(inset + tick, inset); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(w - inset - tick, inset); ctx.lineTo(w - inset, inset); ctx.lineTo(w - inset, inset + tick); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(inset, h - inset - tick); ctx.lineTo(inset, h - inset); ctx.lineTo(inset + tick, h - inset); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(w - inset - tick, h - inset); ctx.lineTo(w - inset, h - inset); ctx.lineTo(w - inset, h - inset - tick); ctx.stroke();
    // CURL CULT wordmark (text fallback — SVG draw is async and
    // may not complete inside a MediaRecorder frame)
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(h * 0.038)}px "Geist", -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('CURL CULT', inset + 10, h - inset - 60);
    // Eyebrow
    ctx.fillStyle = 'rgba(232, 155, 127, 0.9)';
    ctx.font = `500 ${Math.round(h * 0.018)}px "Geist Mono", monospace`;
    ctx.fillText('— CERTIFIED · ' + getStylistId(), inset + 10, h - inset - 28);
  }

  async function capturePhoto() {
    track('capture_photo');
    const video = $('#cam-feed');
    if (!video || !video.videoWidth) {
      showToast('Camera unavailable — enable it first');
      return;
    }
    const W = video.videoWidth;
    const H = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, W, H);
    drawCertifiedOverlay(ctx, W, H);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const file = new File([blob], `curl-cult-${getStylistId()}.jpg`, { type: 'image/jpeg' });
    presentCaptureModal({ url, file, kind: 'photo' });
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
  }

  async function captureVideo() {
    track('capture_video');
    const video = $('#cam-feed');
    if (!video || !video.videoWidth) {
      showToast('Camera unavailable — enable it first');
      return;
    }
    if (!window.MediaRecorder) {
      showToast('Your browser can’t record video');
      return;
    }
    const W = video.videoWidth;
    const H = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Feedback while recording
    const recordingEl = document.createElement('div');
    recordingEl.className = 'capture-recording';
    recordingEl.innerHTML = '<span class="capture-rec-dot"></span> Recording · <span id="cap-counter">5</span>s';
    document.body.appendChild(recordingEl);

    // Composite loop
    let stopped = false;
    const drawLoop = () => {
      if (stopped) return;
      if (video.videoWidth) ctx.drawImage(video, 0, 0, W, H);
      drawCertifiedOverlay(ctx, W, H);
      requestAnimationFrame(drawLoop);
    };
    drawLoop();

    // Pick a MIME type the browser supports
    const mime = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stopped = true;
      recordingEl.remove();
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const ext = (mime.includes('mp4') ? 'mp4' : 'webm');
      const file = new File([blob], `curl-cult-${getStylistId()}.${ext}`, { type: blob.type });
      presentCaptureModal({ url, file, kind: 'video' });
    };

    recorder.start();
    let remaining = 5;
    const tick = setInterval(() => {
      remaining -= 1;
      const c = document.getElementById('cap-counter');
      if (c) c.textContent = Math.max(0, remaining);
      if (navigator.vibrate) navigator.vibrate(8);
      if (remaining <= 0) {
        clearInterval(tick);
        recorder.stop();
      }
    }, 1000);
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  }

  function presentCaptureModal({ url, file, kind }) {
    document.getElementById('capture-modal')?.remove();
    const isVideo = kind === 'video';
    const mediaTag = isVideo
      ? `<video class="salon-modal-img capture-video" src="${url}" autoplay muted loop playsinline></video>`
      : `<img class="salon-modal-img" src="${url}" alt="Your Curl Cult moment">`;
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    const modal = document.createElement('div');
    modal.id = 'capture-modal';
    modal.className = 'salon-modal';
    modal.innerHTML = `
      <div class="salon-modal-inner">
        <button class="salon-modal-close" data-card-close aria-label="Close">×</button>
        <p class="salon-modal-eyebrow">— Your ${isVideo ? 'clip' : 'moment'}</p>
        ${mediaTag}
        <div class="salon-modal-actions">
          <button class="salon-share btn-primary" id="capture-share-btn"><span>${canShare ? 'Share' : 'Save'}</span><span class="arrow">↗</span></button>
          <button class="btn-ghost" data-card-close>Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('capture-share-btn').addEventListener('click', async () => {
      if (canShare) {
        try {
          await navigator.share({ files: [file], title: 'My Curl Cult moment' });
          track('capture_shared', { kind });
        } catch (_) { downloadBlob(url, file.name); }
      } else {
        downloadBlob(url, file.name);
        track('capture_downloaded', { kind });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ROI CARD — "Save this math" — chapter 4's takeaway artifact
  // ───────────────────────────────────────────────────────────────
  // A portrait PNG a stylist can text to their salon owner to justify
  // carrying Curl Cult. Shows base + retail attach + referral lift
  // with the user's picked services/week number baked in.
  // ═══════════════════════════════════════════════════════════════
  async function generateRoiCard() {
    const w = document.querySelector('.roi-widget');
    const svc    = parseInt(w?.dataset.svc || '2', 10);
    const base   = parseInt(w?.dataset.base   || '15600', 10);
    const retail = parseInt(w?.dataset.retail || '3900',  10);
    const lift   = parseInt(w?.dataset.lift   || '5850',  10);
    const annual = parseInt(w?.dataset.annual || '25350', 10);

    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, W, H);
    const radial = ctx.createRadialGradient(W/2, H*0.82, 0, W/2, H*0.82, W);
    radial.addColorStop(0,   'rgba(232, 155, 127, 0.2)');
    radial.addColorStop(0.5, 'rgba(232, 155, 127, 0.06)');
    radial.addColorStop(1,   'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);
    // Grain
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Wordmark
    const TOP_Y = 96;
    try {
      const logo = await loadLogo();
      const logoW = 240;
      const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW;
      ctx.save();
      ctx.filter = 'invert(1) brightness(1.1)';
      ctx.drawImage(logo, (W - logoW)/2, TOP_Y, logoW, logoH);
      ctx.restore();
    } catch (_) {
      ctx.fillStyle = '#fff';
      ctx.font = '600 52px "Geist", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CURL CULT', W/2, TOP_Y + 44);
    }

    // Eyebrow
    ctx.fillStyle = 'rgba(232, 155, 127, 0.75)';
    ctx.font = '500 18px "Geist Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('T H E   M A T H', W/2, TOP_Y + 180);

    // Huge annual number
    ctx.fillStyle = '#f5f5f7';
    ctx.font = '600 132px "Geist", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$' + annual.toLocaleString(), W/2, TOP_Y + 320);

    ctx.fillStyle = 'rgba(232, 155, 127, 0.9)';
    ctx.font = '400 24px "Geist", sans-serif';
    ctx.fillText('Projected annual lift', W/2, TOP_Y + 365);

    // Breakdown card
    const CARD_X = 120, CARD_W = W - 240, CARD_Y = TOP_Y + 450, CARD_H = 420;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    roundedRectPath(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rows inside the card
    const drawRow = (y, label, value, highlight = false) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = highlight ? 'rgba(232, 155, 127, 0.95)' : 'rgba(245, 245, 247, 0.55)';
      ctx.font = '400 22px "Geist", sans-serif';
      ctx.fillText(label, CARD_X + 36, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = highlight ? '#f5f5f7' : '#f5f5f7';
      ctx.font = (highlight ? '600 36px ' : '500 28px ') + '"Geist", sans-serif';
      ctx.fillText('$' + value.toLocaleString(), CARD_X + CARD_W - 36, y);
    };
    const rowH = 72;
    drawRow(CARD_Y + 80,  `Base · ${svc} service${svc > 1 ? 's' : ''} / wk × 52 wks × $150`, base);
    drawRow(CARD_Y + 80 + rowH, 'Retail attach · 25%',  retail);
    drawRow(CARD_Y + 80 + rowH*2, 'Referral lift · 30%', lift);
    // hairline separator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(CARD_X + 36, CARD_Y + 80 + rowH*2 + 40);
    ctx.lineTo(CARD_X + CARD_W - 36, CARD_Y + 80 + rowH*2 + 40);
    ctx.stroke();
    drawRow(CARD_Y + 80 + rowH*3 + 10, 'Annual lift', annual, true);

    // Bottom row
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const sid  = getStylistId();
    ctx.strokeStyle = 'rgba(232, 155, 127, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo((W - 120)/2, H - 138);
    ctx.lineTo((W + 120)/2, H - 138);
    ctx.stroke();
    ctx.fillStyle = 'rgba(134, 134, 139, 0.9)';
    ctx.font = '400 18px "Geist Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${sid}  ·  ${date}`, W/2, H - 100);
    ctx.fillStyle = 'rgba(232, 155, 127, 0.8)';
    ctx.font = '500 18px "Geist Mono", monospace';
    ctx.fillText('curlcult.com', W/2, H - 58);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
  }

  async function showRoiCard() {
    track('roi_card_open');
    if (document.fonts?.ready) { try { await document.fonts.ready; } catch (_) {} }
    const blob = await generateRoiCard();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const file = new File([blob], `curl-cult-roi-${getStylistId()}.png`, { type: 'image/png' });

    document.getElementById('roi-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'roi-modal';
    modal.className = 'salon-modal';
    modal.innerHTML = `
      <div class="salon-modal-inner">
        <button class="salon-modal-close" data-card-close aria-label="Close">×</button>
        <p class="salon-modal-eyebrow">— Your math</p>
        <img class="salon-modal-img" src="${url}" alt="Your Curl Cult ROI card">
        <div class="salon-modal-actions">
          <button class="salon-share btn-primary" id="roi-share-btn"><span>${navigator.canShare && navigator.canShare({ files: [file] }) ? 'Share' : 'Save'}</span><span class="arrow">↗</span></button>
          <button class="btn-ghost" data-card-close>Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('roi-share-btn').addEventListener('click', async () => {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My Curl Cult Math', text: `Projected $${(parseInt(document.querySelector('.roi-widget')?.dataset.annual || '0', 10)).toLocaleString()}/yr with Curl Cult.` });
          track('roi_card_shared');
        } catch (_) { downloadBlob(url, file.name); }
      } else {
        downloadBlob(url, file.name);
        track('roi_card_downloaded');
      }
    });
    if (navigator.vibrate) navigator.vibrate([12, 30, 12]);
  }

  function init() {
    configureModelViewer();
    wireEvents();
    // Debug toggle only visible when ?debug=1 is explicitly present.
    // Hostnames are no longer auto-trusted — tunneled preview URLs
    // (cloudflared, ngrok) should never leak the internal tool.
    const isDev = /\b(debug=1|dev=1|admin=1)\b/.test(location.search);
    if (isDev) $('#debug-toggle')?.classList.add('visible');
    debug.log(`Boot · ${navigator.userAgent.substring(0, 60)}`);
    debug.log(`Viewport · ${window.innerWidth}×${window.innerHeight}`);
    track('experience_start', {
      ua: navigator.userAgent.substring(0, 100),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      secure: window.isSecureContext
    });

    // Register service worker for offline PWA install (booth kiosks).
    // Skipped on http (SW requires https or localhost).
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname.startsWith('127.'))) {
      navigator.serviceWorker.register('sw.js').then(
        (reg) => debug.log('SW registered · scope=' + reg.scope),
        (err) => debug.warn('SW registration failed: ' + err.message)
      );
    }

    // Kick off the asset preloader. BEGIN unlocks when complete.
    preloadAllAssets();

    console.log('%cCURL CULT · AR-first experience', 'font: 600 14px Geist; color: #f5f5f7; letter-spacing: 0.08em');
    console.log('%cTap BEGIN once preload finishes.', 'color: #86868b');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
