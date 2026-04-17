"""
Darken the hair in the portrait GLB.

The model has a single baked material (hair + skin + clothing all share
the same texture atlas). We can't split by material, but we can detect
'hair' pixels in the baseColor texture by hue+saturation and paint them
black before re-exporting the GLB.

Heuristic: hair is warm-brown (hue 10°–45°) with moderate saturation,
skin is warm-pink with lower saturation and higher value. Painting any
warm-brown-saturated pixel to near-black flips hair → black without
muddying skin tones.

Usage:
  blender --background --python darken-hair.py -- <in.glb> <out.glb>
"""
import bpy
import sys
import os
import colorsys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) != 2:
    print('Usage: blender --background --python darken-hair.py -- <in.glb> <out.glb>')
    sys.exit(1)

in_path  = os.path.abspath(argv[0])
out_path = os.path.abspath(argv[1])

bpy.ops.wm.read_homefile(use_empty=True)
print(f'[darken] importing {in_path}')
bpy.ops.import_scene.gltf(filepath=in_path)

# Find the baseColor image
base_img = None
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image and 'basecolor' in node.image.name.lower():
                base_img = node.image
                break

if not base_img:
    print('[darken] no baseColor texture found — aborting')
    sys.exit(2)

w, h = base_img.size
print(f'[darken] found {base_img.name} ({w}x{h}, channels={base_img.channels})')

# Blender stores pixels as a flat RGBA float array (0.0–1.0)
pixels = list(base_img.pixels)

# Pass 1: count + classify pixel classes so we can tune
hair_count = 0
total = w * h
# Target hair → near-black with a subtle charcoal tint so curls still
# catch light rather than reading as a flat silhouette.
HAIR_R, HAIR_G, HAIR_B = 0.02, 0.02, 0.025

# Pass-by-pass classification — yields a float "hair confidence" from 0 to 1.
# 0 = clearly skin/other · 1 = clearly hair strand. The blend strength for
# each pixel is proportional to its confidence, so hair-shadow-on-skin
# pixels get a gentle tint (dark brown) while actual hair strands get
# pushed all the way to black. No more hard pen-stroke streaks at edges.
HAIR_WARM = (0, 50)  # hue range, with 340–360 wraparound also valid
for i in range(0, len(pixels), 4):
    r, g, b, a = pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]
    if a < 0.05:
        continue
    h_, s_, v_ = colorsys.rgb_to_hsv(r, g, b)
    hue_deg = h_ * 360.0
    warm = (hue_deg <= HAIR_WARM[1]) or (hue_deg >= 340)
    if not warm:
        continue

    # Hard protect: bright desaturated skin
    if v_ > 0.62 and s_ < 0.30:
        continue

    # Continuous confidence score:
    #   +1 per condition that's characteristic of hair vs skin.
    # Strength of the final blend = this score clamped to [0, 1].
    sv = s_ / max(v_, 0.02)
    score = 0.0
    # Saturation contribution: hair has more saturated pigment
    score += max(0.0, min(1.0, (s_ - 0.18) / 0.28))       # 0 at s=0.18, 1 at s=0.46
    # Darkness contribution: hair is darker than skin midtones
    score += max(0.0, min(1.0, (0.55 - v_) / 0.30))       # 0 at v=0.55, 1 at v=0.25
    # s/v ratio: high = pigmented hair, low = occlusion shadow on skin
    score += max(0.0, min(1.0, (sv - 0.75) / 0.55))       # 0 at sv=0.75, 1 at sv=1.30
    # Average the three into [0, 1]
    conf = score / 3.0

    # Below this confidence the pixel is almost certainly skin — skip
    if conf < 0.45:
        continue

    # Steep remap so the transition is fast: only confidence ≥ 0.75
    # gets near-full black; lower confidence gets a darker-brown tint.
    # conf 0.45 → blend 0.20   (very soft tint)
    # conf 0.60 → blend 0.55
    # conf 0.75 → blend 0.85
    # conf 1.00 → blend 0.95
    t = (conf - 0.45) / 0.55
    blend = 0.20 + (t ** 1.4) * 0.75
    pixels[i]   = HAIR_R * blend + r * (1 - blend)
    pixels[i+1] = HAIR_G * blend + g * (1 - blend)
    pixels[i+2] = HAIR_B * blend + b * (1 - blend)
    hair_count += 1

print(f'[darken] painted {hair_count} / {total} pixels ({100.0 * hair_count / total:.1f}%)')

# Write back the pixels
base_img.pixels = pixels
# Mark image as dirty so it gets re-packed on export
base_img.update()
base_img.pack()

# Export new GLB. use_active_collection=False, embed textures.
print(f'[darken] exporting {out_path}')
# Decimate geometry — the original has 1.9M triangles from a loose
# Tripo decimation; we don't need that for a rotating hero shot and
# decimating makes the final GLB ship in < 10 MB after Draco.
TRI_BUDGET = 220000
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    tri = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tri <= TRI_BUDGET:
        continue
    ratio = TRI_BUDGET / tri
    print(f'[darken] decimate {obj.name}: {tri} → ~{TRI_BUDGET} (ratio {ratio:.3f})')
    mod = obj.modifiers.new(name='HairDecimate', type='DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_image_format='JPEG',
    export_image_quality=85,
    export_materials='EXPORT',
    export_normals=True,
    export_texcoords=True,
    export_apply=False,
    # Draco mesh compression drops the GLB by ~5×
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
)

print(f'[darken] done')
