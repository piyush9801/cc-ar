"""
High-quality portrait export — no decimation, PNG textures, keeps
hair-darkening pass but ships the result at native fidelity for AR.
Usage:
  blender --background --python export-portrait-hq.py -- <in.glb> <out.glb>
"""
import bpy, sys, os, colorsys
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) != 2: sys.exit(1)
in_path, out_path = os.path.abspath(argv[0]), os.path.abspath(argv[1])

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=in_path)

# Find baseColor texture + darken hair (same graduated blend as before)
base_img = None
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH': continue
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes: continue
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image and 'basecolor' in node.image.name.lower():
                base_img = node.image

if base_img:
    w, h = base_img.size
    pixels = list(base_img.pixels)
    HAIR_R, HAIR_G, HAIR_B = 0.02, 0.02, 0.025
    painted = 0
    for i in range(0, len(pixels), 4):
        r, g, b, a = pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]
        if a < 0.05: continue
        h_, s_, v_ = colorsys.rgb_to_hsv(r, g, b)
        hue_deg = h_ * 360.0
        warm = hue_deg <= 50 or hue_deg >= 340
        if not warm: continue
        if v_ > 0.62 and s_ < 0.30: continue
        sv = s_ / max(v_, 0.02)
        score = 0.0
        score += max(0.0, min(1.0, (s_ - 0.18) / 0.28))
        score += max(0.0, min(1.0, (0.55 - v_) / 0.30))
        score += max(0.0, min(1.0, (sv - 0.75) / 0.55))
        conf = score / 3.0
        if conf < 0.45: continue
        t = (conf - 0.45) / 0.55
        blend = 0.20 + (t ** 1.4) * 0.75
        pixels[i]   = HAIR_R * blend + r * (1 - blend)
        pixels[i+1] = HAIR_G * blend + g * (1 - blend)
        pixels[i+2] = HAIR_B * blend + b * (1 - blend)
        painted += 1
    base_img.pixels = pixels
    base_img.update()
    base_img.pack()
    print(f'[portrait] painted {painted} hair pixels')

# Moderate decimation — keep 600k triangles (3× what we had, still large
# enough that compression artifacts don't show in native AR)
TRI_BUDGET = 600000
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH': continue
    tri = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tri <= TRI_BUDGET: continue
    ratio = TRI_BUDGET / tri
    print(f'[portrait] decimate {obj.name}: {tri} → ~{TRI_BUDGET}')
    mod = obj.modifiers.new(name='PortraitDec', type='DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

# Draco mesh compression (lossless for mesh) + PNG textures preserved
print(f'[portrait] exporting {out_path}')
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_image_format='AUTO',   # PNG stays PNG — no JPEG encoding
    export_materials='EXPORT',
    export_normals=True,
    export_texcoords=True,
    export_apply=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=16,  # higher = more precision
    export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=14,
)
print('[portrait] done')
