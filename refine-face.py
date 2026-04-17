"""
Refine the face texture on the portrait GLB.

Two passes on the baked textures:

  1. baseColor — detect skin pixels (pink/tan, low sat, high value)
     and apply: slight desaturation + local box-blur smoothing.
     This removes painterly patchiness from the Tripo generation
     without affecting hair (already black from previous pass) or
     clothing.

  2. roughness/metallic (rm) — detect skin in the *baseColor* (same
     mask) and set those pixels to high roughness so they render
     matte. Keeps hair at its exported roughness for natural sheen.

Also re-runs the hair-darkening heuristic so both passes happen in
a single export — source of truth stays the original source GLB.

Usage:
  blender --background --python refine-face.py -- <in.glb> <out.glb>
"""
import bpy
import sys
import os
import colorsys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) != 2:
    print('Usage: blender --background --python refine-face.py -- <in.glb> <out.glb>')
    sys.exit(1)

in_path  = os.path.abspath(argv[0])
out_path = os.path.abspath(argv[1])

bpy.ops.wm.read_homefile(use_empty=True)
print(f'[refine] importing {in_path}')
bpy.ops.import_scene.gltf(filepath=in_path)

# Find baseColor + rm textures
base_img = None
rm_img = None
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type != 'TEX_IMAGE' or not node.image:
                continue
            name = node.image.name.lower()
            if 'basecolor' in name:
                base_img = node.image
            elif name.endswith('_rm') or 'rough' in name or 'metal' in name:
                rm_img = node.image

if not base_img:
    print('[refine] no baseColor texture found')
    sys.exit(2)

w, h = base_img.size
print(f'[refine] baseColor: {base_img.name} {w}x{h}')
if rm_img:
    print(f'[refine] rm:        {rm_img.name} {rm_img.size[0]}x{rm_img.size[1]}')

base_px = list(base_img.pixels)
PIXELS = w * h

# ───────────────────────────────────────────────────────────────
# PASS 1: classify every pixel as HAIR / SKIN / OTHER
# ───────────────────────────────────────────────────────────────
HAIR = 1
SKIN = 2
OTHER = 0

classes = bytearray(PIXELS)
for i in range(PIXELS):
    p = i * 4
    r, g, b, a = base_px[p], base_px[p+1], base_px[p+2], base_px[p+3]
    if a < 0.05:
        continue
    h_, s_, v_ = colorsys.rgb_to_hsv(r, g, b)
    hue_deg = h_ * 360.0
    warm = (hue_deg <= 50) or (hue_deg >= 340)
    is_hair_A = warm and s_ > 0.22 and v_ < 0.55
    is_hair_B = warm and s_ > 0.12 and v_ < 0.40
    is_skin_ish = warm and 0.35 <= v_ <= 0.95 and 0.10 <= s_ <= 0.55 and not (is_hair_A or is_hair_B)
    if is_hair_A or is_hair_B:
        classes[i] = HAIR
    elif is_skin_ish:
        classes[i] = SKIN

hair_n = sum(1 for c in classes if c == HAIR)
skin_n = sum(1 for c in classes if c == SKIN)
print(f'[refine] classified · hair={hair_n} ({100*hair_n/PIXELS:.1f}%) skin={skin_n} ({100*skin_n/PIXELS:.1f}%)')

# ───────────────────────────────────────────────────────────────
# PASS 2: paint hair black (same as before)
# ───────────────────────────────────────────────────────────────
HAIR_R, HAIR_G, HAIR_B = 0.02, 0.02, 0.025
for i in range(PIXELS):
    if classes[i] != HAIR:
        continue
    p = i * 4
    r, g, bl = base_px[p], base_px[p+1], base_px[p+2]
    blend = 0.96
    base_px[p]   = HAIR_R * blend + r  * (1 - blend)
    base_px[p+1] = HAIR_G * blend + g  * (1 - blend)
    base_px[p+2] = HAIR_B * blend + bl * (1 - blend)

# ───────────────────────────────────────────────────────────────
# PASS 3: skin smoothing
# For every SKIN pixel, replace its RGB with the *average* of its
# 3×3 neighborhood (only counting SKIN neighbors). Then desaturate
# slightly to remove the painterly hot-pink blotches.
# ───────────────────────────────────────────────────────────────
def idx(x, y):
    return y * w + x

# One pass of neighborhood-average blur, skin-only
smoothed = list(base_px)
for y in range(1, h - 1):
    for x in range(1, w - 1):
        i = idx(x, y)
        if classes[i] != SKIN:
            continue
        rs, gs, bs, n = 0.0, 0.0, 0.0, 0
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                j = idx(x + dx, y + dy)
                if classes[j] == SKIN:
                    q = j * 4
                    rs += base_px[q]; gs += base_px[q+1]; bs += base_px[q+2]
                    n += 1
        if n > 0:
            q = i * 4
            smoothed[q]   = rs / n
            smoothed[q+1] = gs / n
            smoothed[q+2] = bs / n
base_px = smoothed

# Desaturate skin pixels by 20% — flattens the oversaturated pink
DESAT = 0.80
for i in range(PIXELS):
    if classes[i] != SKIN:
        continue
    p = i * 4
    r, g, b = base_px[p], base_px[p+1], base_px[p+2]
    h_, s_, v_ = colorsys.rgb_to_hsv(r, g, b)
    s_ *= DESAT
    r2, g2, b2 = colorsys.hsv_to_rgb(h_, s_, v_)
    base_px[p]   = r2
    base_px[p+1] = g2
    base_px[p+2] = b2

base_img.pixels = base_px
base_img.update()
base_img.pack()
print('[refine] baseColor written')

# ───────────────────────────────────────────────────────────────
# PASS 4: roughness/metallic — force skin to matte
# glTF convention: R=occlusion, G=roughness, B=metallic (for packed rm)
# Tripo's packed format may differ. We'll set G high (rough) and
# B low (non-metallic) for skin pixels.
# ───────────────────────────────────────────────────────────────
if rm_img and rm_img.size[0] == w and rm_img.size[1] == h:
    rm_px = list(rm_img.pixels)
    for i in range(PIXELS):
        if classes[i] != SKIN:
            continue
        p = i * 4
        # Keep red channel (occlusion), set green=0.9 (very rough), blue=0 (not metal)
        rm_px[p+1] = 0.9   # roughness
        rm_px[p+2] = 0.0   # metallic
    rm_img.pixels = rm_px
    rm_img.update()
    rm_img.pack()
    print('[refine] rm written · skin set to roughness=0.9')
else:
    print('[refine] rm texture missing or size mismatch · skipping')

# ───────────────────────────────────────────────────────────────
# PASS 5: decimate geometry + export GLB w/ Draco
# ───────────────────────────────────────────────────────────────
TRI_BUDGET = 220000
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    tri = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tri <= TRI_BUDGET:
        continue
    ratio = TRI_BUDGET / tri
    print(f'[refine] decimate {obj.name}: {tri} → ~{TRI_BUDGET}')
    mod = obj.modifiers.new(name='FaceDecimate', type='DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

print(f'[refine] exporting {out_path}')
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_image_format='JPEG',
    export_image_quality=88,
    export_materials='EXPORT',
    export_normals=True,
    export_texcoords=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
)
print('[refine] done')
