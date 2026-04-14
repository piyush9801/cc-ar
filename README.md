# Curl Cult — AR Experience

An 8-screen guided in-store AR walkthrough for stylists shopping Curl Cult at CosmoProf. Built from the brief in `cc ar app.pdf` using the `mobile-ar` Claude Code skill.

## What's inside

| Screen | Name | Tech |
|---|---|---|
| 1 | Welcome / Tap to Enter | HTML + camera feed bg |
| 2 | Founder Janine intro + 3 bubbles | HTML + SVG portrait |
| 3 | One Formula / All Hair Types | HTML + SVG hair |
| 4 | **+$30k Per Year** + 3D chair | `<model-viewer>` |
| 5 | Product constellation | `<model-viewer>` + CSS ghost bottles |
| 6 | **Magic Spell** detail with tooltip | `<model-viewer>` + tooltip card |
| 7 | Level Up Your Skills CTA | HTML buttons |
| 8 | Join the Cult email capture | HTML form + localStorage |

## Features

- ✅ Live camera background (persistent across all 8 screens)
- ✅ Portrait-locked, mobile-first, responsive down to 320px wide
- ✅ Curl Cult brand palette — near-black + rose-salmon + olive-sage + handwritten Caveat font
- ✅ Smooth page transitions with CSS
- ✅ Progress dots (1/8, 2/8…) showing position
- ✅ Restart button visible on every screen after screen 1
- ✅ "View in your salon" Model Viewer AR button on chair
- ✅ "View at your station" AR button on spray bottle
- ✅ LocalStorage email/phone capture (no backend needed)
- ✅ Analytics events logged to console + localStorage
- ✅ Keyboard shortcuts for desktop testing (→/←/r)
- ✅ Click progress dots to jump between screens (demo mode)
- ✅ Permission gate for camera (with "continue without camera" fallback)
- ✅ Haptic feedback on screen transitions (supported devices)

## Assets

- `assets/chair.glb` — luxury salon chair, Draco-compressed (54 MB → 3.3 MB, 94% reduction)
- `assets/bottle.glb` — spray bottle, Draco-compressed (19 MB → 1.9 MB, 90% reduction)

**Note on iOS AR:** The `ar-modes` attribute includes `quick-look`, but iOS Quick Look requires a `.usdz` version. To add full iPhone AR support:
1. Install [Reality Converter](https://developer.apple.com/augmented-reality/tools/) on a Mac (free)
2. Drag `assets/chair.glb` into it → File → Export as USDZ → save to `assets/chair.usdz`
3. Repeat for `bottle.glb`
4. Add `ios-src="assets/chair.usdz"` and `ios-src="assets/bottle.usdz"` to the respective `<model-viewer>` tags in `index.html`

Without the `.usdz` files, the AR button will work on Android (Scene Viewer) and fall back to in-page 3D on iOS.

## Run Locally

Camera APIs require HTTPS or localhost. Three easy options:

### Option 1: Python (simplest)
```bash
cd curl-cult-ar-experience
python3 -m http.server 8080
# open http://localhost:8080 on your desktop
```

### Option 2: ngrok (test on your phone)
```bash
# In one terminal:
python3 -m http.server 8080

# In another terminal:
ngrok http 8080
# Copy the HTTPS URL, open it on your phone
```

### Option 3: Vite (auto-reload)
```bash
npm install -g vite
vite . --host --https
```

## Deploy

It's a fully static site. Deploy anywhere:
- **Vercel:** `vercel .` (free)
- **Netlify:** drag the folder into app.netlify.com (free)
- **GitHub Pages:** push to a repo, enable Pages (free)
- **Cloudflare Pages:** connect a repo (free)

## Desktop Testing Keyboard Shortcuts

| Key | Action |
|---|---|
| `→` or `Space` | Next screen |
| `←` | Previous screen |
| `r` | Restart experience |
| Click progress dot | Jump to that screen |

## Analytics

All events are logged to the browser console **and** persisted to `localStorage.curlcult_events` (capped at last 100). Events captured:

- `experience_start` — initial load
- `camera_enabled` / `camera_denied` / `camera_skipped`
- `screen_view` — every screen transition with from/to
- `model_loaded` / `model_error` — 3D asset loading
- `ar_status` — AR session events (not-presenting, session-started, object-placed, failed)
- `contact_captured` — email/phone submit with type
- `contact_invalid` — validation failure
- `experience_restart`

To wire to a real backend, replace the `track()` function in `app.js:20` with a `fetch()` to your endpoint.

## Browser Support

| Feature | iOS Safari | Android Chrome |
|---|---|---|
| Camera feed | ✅ | ✅ |
| 3D rendering | ✅ | ✅ |
| "View in AR" button | ⚠️ needs `.usdz` (see above) | ✅ out of the box |
| Email capture | ✅ | ✅ |
| LocalStorage | ✅ | ✅ |

Minimum OS: iOS 15, Android 9.

## File Sizes

| File | Size |
|---|---|
| index.html | ~10 KB |
| style.css | ~18 KB |
| app.js | ~6 KB |
| chair.glb (Draco) | 3.3 MB |
| bottle.glb (Draco) | 1.9 MB |
| Fonts (Google CDN) | ~40 KB |
| Model Viewer lib (CDN) | ~280 KB gzipped |
| **Total first-load** | **~5.5 MB** |

Compression details: Draco level 10 via `gltf-pipeline`.

## Credits

- 3D models: user-provided (`luxury salon chair 3d model.glb`, `spray bottle 3d model.glb`)
- [Google Model Viewer](https://modelviewer.dev) — web component for 3D + AR
- Google Fonts: [Caveat](https://fonts.google.com/specimen/Caveat), [Inter](https://fonts.google.com/specimen/Inter)
- Built with Claude Code's [`mobile-ar`](../../.claude/skills/mobile-ar/SKILL.md) skill
