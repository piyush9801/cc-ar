/* ═══════════════════════════════════════════════════════════════
   CURL CULT · Audio
   ───────────────────────────────────────────────────────────────
   Zero-dependency Web Audio module. Procedurally generates every
   sound — no MP3s to download, no external libs. All sounds are
   subtle and match the editorial minimalism of the UI.

   Exposes a single global `cc` audio API:
     cc.chime()    // chapter-change soft pentatonic blip
     cc.confirm()  // quiz-correct rising 3-note
     cc.deny()     // quiz-wrong low tick
     cc.tap()      // hotspot / button tap (high blip)
     cc.begin()    // landing → chapter 1 swoop
     cc.ambient()  // starts the looping ambient bed (call once on gesture)
     cc.setEnabled(bool) // master mute

   All public methods are no-ops if audio isn't initialized. Init
   happens lazily on first gesture (browser autoplay policy).
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';
  let ctx = null;
  let masterGain = null;
  let ambientNodes = null;
  let enabled = true;

  // Respect earlier VO-mute preference as the default for sound too
  try {
    if (localStorage.getItem('cc_audio_muted') === '1') enabled = false;
  } catch (_) {}

  function ensureCtx() {
    if (ctx) return ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = enabled ? 0.35 : 0;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  // ── Low-level helper: play a note with ADSR envelope ───────────
  function playNote({ freq, duration = 0.4, type = 'sine', gain = 0.25, attack = 0.008, release = 0.18, startOffset = 0 }) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + startOffset;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.linearRampToValueAtTime(gain * 0.6, t0 + attack + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  // Pentatonic scale starting at A4 — always harmonious
  const PENT = [220, 247, 277, 330, 370, 440, 494, 554, 660, 740];

  // ── Public API ─────────────────────────────────────────────────

  // Chapter-change chime — two overlapping pentatonic blips
  function chime() {
    playNote({ freq: PENT[6], duration: 0.5, type: 'sine', gain: 0.22, attack: 0.01, release: 0.4 });
    playNote({ freq: PENT[8], duration: 0.55, type: 'triangle', gain: 0.14, startOffset: 0.06 });
  }

  // Quiz-correct rising third — hopeful, non-childish
  function confirm() {
    playNote({ freq: PENT[5], duration: 0.22, type: 'sine', gain: 0.22 });
    playNote({ freq: PENT[7], duration: 0.28, type: 'sine', gain: 0.22, startOffset: 0.08 });
    playNote({ freq: PENT[9], duration: 0.45, type: 'triangle', gain: 0.18, startOffset: 0.18 });
  }

  // Quiz-wrong — soft descending tick, not punishing
  function deny() {
    playNote({ freq: PENT[3], duration: 0.16, type: 'triangle', gain: 0.18 });
    playNote({ freq: PENT[1], duration: 0.28, type: 'sine', gain: 0.14, startOffset: 0.06 });
  }

  // Tap — short high blip
  function tap() {
    playNote({ freq: PENT[7], duration: 0.08, type: 'sine', gain: 0.14, attack: 0.002 });
  }

  // Begin swoop — when the user taps BEGIN and the session starts
  function begin() {
    playNote({ freq: PENT[2], duration: 0.5, type: 'sine',     gain: 0.25 });
    playNote({ freq: PENT[5], duration: 0.5, type: 'triangle', gain: 0.2, startOffset: 0.12 });
    playNote({ freq: PENT[8], duration: 0.6, type: 'sine',     gain: 0.18, startOffset: 0.22 });
  }

  // ── Ambient bed ────────────────────────────────────────────────
  // Layered soft drone: filtered pink noise + two slow sine drones
  // at a major-7th interval. Sits at -28dB, inaudible unless you
  // listen for it — adds spatial presence without distracting.
  function ambient() {
    if (ambientNodes) return; // already running
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    // Pink-noise source via buffer
    const bufSize = 2 * c.sampleRate;
    const buffer = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Low-pass filter the noise heavily so it reads as "room tone"
    const noiseFilter = c.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 420;
    noiseFilter.Q.value = 0.8;

    const noiseGain = c.createGain();
    noiseGain.gain.value = 0.0; // fade in
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start();

    // Drone 1 — deep foundation
    const drone1 = c.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.value = 82.4; // E2
    const drone1Gain = c.createGain();
    drone1Gain.gain.value = 0.0;
    drone1.connect(drone1Gain);
    drone1Gain.connect(masterGain);
    drone1.start();

    // Drone 2 — gentle harmonic color
    const drone2 = c.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 277.18; // C#4 (major 7 above E2 + 3 octaves — spa-calm)
    const drone2Gain = c.createGain();
    drone2Gain.gain.value = 0.0;
    drone2.connect(drone2Gain);
    drone2Gain.connect(masterGain);
    drone2.start();

    // LFO on drone2 pitch for very slow vibrato (life, not busy)
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 1.6;
    lfo.connect(lfoGain);
    lfoGain.connect(drone2.frequency);
    lfo.start();

    // Slow fade-in over 4 seconds
    const now = c.currentTime;
    noiseGain.gain.linearRampToValueAtTime(0.055, now + 4);
    drone1Gain.gain.linearRampToValueAtTime(0.05, now + 4);
    drone2Gain.gain.linearRampToValueAtTime(0.025, now + 5);

    ambientNodes = { noise, drone1, drone2, lfo, noiseGain, drone1Gain, drone2Gain };
  }

  function stopAmbient() {
    if (!ambientNodes) return;
    const c = ctx;
    if (!c) return;
    const now = c.currentTime;
    // Fade out over 0.6s
    ambientNodes.noiseGain.gain.linearRampToValueAtTime(0, now + 0.6);
    ambientNodes.drone1Gain.gain.linearRampToValueAtTime(0, now + 0.6);
    ambientNodes.drone2Gain.gain.linearRampToValueAtTime(0, now + 0.6);
    setTimeout(() => {
      try {
        ambientNodes.noise.stop();
        ambientNodes.drone1.stop();
        ambientNodes.drone2.stop();
        ambientNodes.lfo.stop();
      } catch (_) {}
      ambientNodes = null;
    }, 700);
  }

  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem('cc_audio_muted', enabled ? '0' : '1'); } catch (_) {}
    if (!masterGain) return;
    const c = ctx;
    const now = c ? c.currentTime : 0;
    masterGain.gain.linearRampToValueAtTime(enabled ? 0.35 : 0, now + 0.2);
    if (!enabled) stopAmbient();
  }

  function isEnabled() { return enabled; }

  // ── Expose ──────────────────────────────────────────────────────
  window.cc = {
    chime, confirm, deny, tap, begin,
    ambient, stopAmbient,
    setEnabled, isEnabled,
  };
})();
