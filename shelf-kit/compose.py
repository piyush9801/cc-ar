#!/usr/bin/env python3
"""
Compose the Curl Cult Magic Spell bottle image with a QR code overlay
and a "SCAN TO START AR" label, producing a single shareable image.

The QR is placed in the bottom-right corner on the olive background
(not overlapping the bottle, which preserves MindAR tracking features).
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

ROOT = Path(__file__).parent.parent
TARGET = ROOT / "assets" / "target.png"
QR = ROOT / "shelf-kit" / "qr-code.png"
OUT = ROOT / "shelf-kit" / "bottle-with-qr.png"

# Brand palette
ROSE = (232, 155, 127, 255)       # Curl Cult salmon/rose
OLIVE = (191, 194, 136, 255)      # Curl Cult olive
DARK = (26, 10, 5, 255)           # Dark text on rose
WHITE = (255, 255, 255, 255)

# ───────────────────────────────────────────────────────────────
# 1. Load the base (target) image and upgrade to RGBA
# ───────────────────────────────────────────────────────────────
base = Image.open(TARGET).convert("RGBA")
W, H = base.size  # 1080 x 1080
print(f"Base: {W}x{H}")

# ───────────────────────────────────────────────────────────────
# 2. Load QR and resize
# ───────────────────────────────────────────────────────────────
QR_SIZE = 260   # Desired QR size on the final image
PAD = 22        # White padding around QR for contrast/scannability
LABEL_H = 56    # Space below QR for the "SCAN" label
CARD_W = QR_SIZE + 2 * PAD
CARD_H = QR_SIZE + 2 * PAD + LABEL_H
MARGIN = 40     # Distance from corner of image

qr = Image.open(QR).convert("RGBA").resize((QR_SIZE, QR_SIZE), Image.LANCZOS)

# ───────────────────────────────────────────────────────────────
# 3. Build the QR card (white rounded rect + rose accent border)
# ───────────────────────────────────────────────────────────────
card = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
card_draw = ImageDraw.Draw(card)

# Rounded rect bg (white)
def rounded_rect(draw, xy, radius, fill, outline=None, width=0):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

rounded_rect(card_draw, (0, 0, CARD_W, CARD_H), radius=18, fill=WHITE)

# Thin rose border
rounded_rect(card_draw, (2, 2, CARD_W - 2, CARD_H - 2), radius=16, fill=None, outline=ROSE, width=3)

# Paste QR inside (offset by padding)
card.paste(qr, (PAD, PAD), qr)

# ───────────────────────────────────────────────────────────────
# 4. Add "SCAN TO START AR" label below QR
# ───────────────────────────────────────────────────────────────
# Try to load a nice font; fall back to default
def find_font(candidates, size):
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()

label_font = find_font([
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Bold.ttf",
], 22)

label_text = "SCAN TO START AR"
bbox = card_draw.textbbox((0, 0), label_text, font=label_font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]

label_y = PAD + QR_SIZE + 8
card_draw.text(((CARD_W - tw) // 2, label_y), label_text,
               font=label_font, fill=DARK)

# ───────────────────────────────────────────────────────────────
# 5. Add a subtle drop shadow behind the card
# ───────────────────────────────────────────────────────────────
shadow = Image.new("RGBA", (CARD_W + 40, CARD_H + 40), (0, 0, 0, 0))
shadow_draw = ImageDraw.Draw(shadow)
shadow_draw.rounded_rectangle((20, 25, CARD_W + 20, CARD_H + 25),
                              radius=20, fill=(0, 0, 0, 130))
shadow = shadow.filter(ImageFilter.GaussianBlur(radius=14))

# ───────────────────────────────────────────────────────────────
# 6. Paste shadow + card onto the base image, bottom-right corner
# ───────────────────────────────────────────────────────────────
pos_x = W - CARD_W - MARGIN
pos_y = H - CARD_H - MARGIN

# shadow is 40px larger than card; offset so it appears behind
base.paste(shadow, (pos_x - 20, pos_y - 25), shadow)
base.paste(card, (pos_x, pos_y), card)

# ───────────────────────────────────────────────────────────────
# 7. Optional: add a small "curl cult" wordmark in top-right
# ───────────────────────────────────────────────────────────────
brand_font = find_font([
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
], 30)

brand_draw = ImageDraw.Draw(base)
brand_text = "CURL CULT AR"
bbox = brand_draw.textbbox((0, 0), brand_text, font=brand_font)
tw = bbox[2] - bbox[0]
brand_draw.text((W - tw - MARGIN, MARGIN + 10), brand_text,
                font=brand_font, fill=(255, 255, 255, 240))
# small dot accent
brand_draw.ellipse((W - tw - MARGIN - 18, MARGIN + 22, W - tw - MARGIN - 8, MARGIN + 32),
                   fill=ROSE)

# ───────────────────────────────────────────────────────────────
# 8. Save result
# ───────────────────────────────────────────────────────────────
OUT.parent.mkdir(parents=True, exist_ok=True)
base.save(OUT, "PNG", optimize=True)
print(f"✓ Saved: {OUT}")
print(f"   Size: {base.size}  ·  Bytes: {OUT.stat().st_size:,}")
