#!/usr/bin/env node
/**
 * Generate a texture for chapter 2 ("Bonds break first").
 *
 * Preferred: Google Gemini image-generation API.
 * Fallback:  editorial procedural SVG (dark frame, single hair fiber
 *            with split ends + escaping gold particles from fracture
 *            points) that matches the brand direction.
 *
 * Usage:
 *   node generate-texture.mjs [outfile] ["prompt"]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// Load .env.local
try {
  const env = await fs.readFile('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch (_) {}

const API_KEY = process.env.GEMINI_API_KEY;
const outFile = process.argv[2] || 'assets/ch2-damage.png';
const outSvg  = outFile.replace(/\.png$/, '.svg');
const prompt  = process.argv[3] || [
  'Extreme macro photograph of a single human hair strand fracturing.',
  'Cinematic beauty editorial. Pitch black background with a narrow warm',
  'amber rim light. Brown glossy hair fiber with visible split ends and',
  'tiny golden particles escaping the fiber. Shallow depth of field,',
  'no text, no logos, no watermark, no people.'
].join(' ');

// ───────────────────────────────────────────────────────────────
// 1. Try Gemini image-generation API
// ───────────────────────────────────────────────────────────────
async function tryGemini() {
  if (!API_KEY) return { ok: false, error: 'no GEMINI_API_KEY set' };
  const ENDPOINTS = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  ];
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  let lastMsg = '';
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { lastMsg = `${res.status} ${json?.error?.message || res.statusText}`; console.warn(`  ${lastMsg}`); continue; }
      for (const p of (json?.candidates?.[0]?.content?.parts || [])) {
        const inline = p.inlineData || p.inline_data;
        if (inline?.data) {
          return { ok: true, mime: inline.mimeType || 'image/png', buf: Buffer.from(inline.data, 'base64') };
        }
      }
    } catch (e) { lastMsg = e.message; console.warn(`  fetch failed: ${lastMsg}`); }
  }
  return { ok: false, error: lastMsg || 'all endpoints rejected' };
}

// ───────────────────────────────────────────────────────────────
// 2. Procedural SVG fallback — editorial, shipped immediately
// ───────────────────────────────────────────────────────────────
function proceduralSvg() {
  const W = 1200, H = 1600;
  const fiber = [];
  const fractures = [];
  const fiberX0 = W * 0.5;
  const amp = 28;
  const steps = 260;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = H * 0.05 + t * H * 0.9;
    const wave = Math.sin(t * Math.PI * 4) * amp + Math.sin(t * Math.PI * 11) * 4;
    const x = fiberX0 + wave;
    fiber.push({ x, y });
    if (Math.abs(t - 0.28) < 0.012 || Math.abs(t - 0.54) < 0.012 || Math.abs(t - 0.78) < 0.012) {
      fractures.push({ x, y });
    }
  }
  const pathD = fiber.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const particles = [];
  for (const f of fractures) {
    for (let i = 0; i < 22; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 1.2;
      const r = 8 + Math.random() * 90;
      particles.push({
        x: f.x + Math.cos(angle) * r,
        y: f.y + Math.sin(angle) * r * 0.6,
        size: 1.2 + Math.random() * 3.8,
        opacity: 0.4 + Math.random() * 0.6,
      });
    }
  }
  const bokeh = [];
  for (let i = 0; i < 70; i++) {
    bokeh.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 0.5 + Math.random() * 2,
      opacity: 0.05 + Math.random() * 0.25,
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="rim" cx="88%" cy="50%" r="80%">
      <stop offset="0%"  stop-color="#E89B7F" stop-opacity="0.38"/>
      <stop offset="40%" stop-color="#E89B7F" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fiber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#5a3a28"/>
      <stop offset="35%" stop-color="#8b5a3e"/>
      <stop offset="65%" stop-color="#6a4330"/>
      <stop offset="100%" stop-color="#3a241a"/>
    </linearGradient>
    <linearGradient id="fiberShine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="50%" stop-color="#fff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#050505"/>
  <rect width="${W}" height="${H}" fill="url(#rim)"/>
  ${bokeh.map(b => `<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.size.toFixed(2)}" fill="#fff" opacity="${b.opacity.toFixed(3)}"/>`).join('\n  ')}
  <path d="${pathD}" fill="none" stroke="#000" stroke-width="38" stroke-linecap="round" opacity="0.6" transform="translate(4 8)"/>
  <path d="${pathD}" fill="none" stroke="url(#fiber)" stroke-width="30" stroke-linecap="round"/>
  <path d="${pathD}" fill="none" stroke="url(#fiberShine)" stroke-width="26" stroke-linecap="round" opacity="0.55"/>
  <path d="${pathD}" fill="none" stroke="#000" stroke-width="22" stroke-linecap="round" opacity="0.18" stroke-dasharray="1.5 3.5"/>
  ${fractures.map(f => `<ellipse cx="${f.x.toFixed(1)}" cy="${f.y.toFixed(1)}" rx="18" ry="5" fill="#000" opacity="0.85" transform="rotate(${(Math.random()*60-30).toFixed(1)} ${f.x.toFixed(1)} ${f.y.toFixed(1)})"/>`).join('\n  ')}
  ${particles.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.size.toFixed(2)}" fill="#E89B7F" opacity="${p.opacity.toFixed(3)}" filter="url(#glow)"/>`).join('\n  ')}
  ${Array.from({ length: 900 }, () => {
    const x = Math.random() * W, y = Math.random() * H;
    const c = Math.random() > 0.5 ? '#fff' : '#000';
    return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="1" height="1" fill="${c}" opacity="${(Math.random() * 0.08).toFixed(3)}"/>`;
  }).join('\n  ')}
</svg>`;
}

// ───────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────
console.log('[gen] chapter 2 texture');
const gem = await tryGemini();
if (gem.ok) {
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, gem.buf);
  console.log(`[gen] gemini → ${outFile} (${(gem.buf.length / 1024).toFixed(1)} KB)`);
  process.exit(0);
}
console.warn(`[gen] gemini unavailable (${gem.error}) — writing procedural SVG`);
const svg = proceduralSvg();
await fs.mkdir(path.dirname(outSvg), { recursive: true });
await fs.writeFile(outSvg, svg);
console.log(`[gen] wrote ${outSvg} (${(svg.length / 1024).toFixed(1)} KB)`);
console.log('[gen] swap in a Gemini PNG later by saving it to ' + outFile);
