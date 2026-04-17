"""
Glass-morphism material pass for the liquid-drop sculpture.

Two shaders, both using glTF PBR with KHR_materials_transmission so
model-viewer renders proper refraction (not fake alpha blending):

  • DropGlassMat — dark mahogany TINTED GLASS. High transmission,
    low roughness, IOR 1.5, strong clear-coat for a wet-glaze top
    layer. The brown tint colors light as it passes through.

  • BubbleGlassMat — near-clear amber glass with iridescence +
    stronger emission so the bubbles catch warm rim-light like
    the reference pearls.

Bubbles are auto-detected by bounding-box sphericity + size.

Usage:
  blender --background --python material-liquid-drop.py -- <in.glb> <out.glb>
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) != 2:
    print('Usage: ... -- <in.glb> <out.glb>')
    sys.exit(1)

in_path  = os.path.abspath(argv[0])
out_path = os.path.abspath(argv[1])

bpy.ops.wm.read_homefile(use_empty=True)
print(f'[mat] importing {in_path}')
bpy.ops.import_scene.gltf(filepath=in_path)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    print('[mat] no mesh found'); sys.exit(2)

total_tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
print(f'[mat] {len(meshes)} parts · total tris={total_tri}')

# ───────────────────────────────────────────────────────────────
# Build two principled-BSDF materials
# ───────────────────────────────────────────────────────────────
def build_material(name, config):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    # Enable blend mode for transmission export to work
    mat.blend_method = 'BLEND'
    try:
        mat.use_screen_refraction = True
    except Exception:
        pass
    nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (600, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (200, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    for k, v in config.items():
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v
    return mat

# Dark mahogany glass — rich brown serum inside a glass drop
drop_mat = build_material('DropGlassMat', {
    # A bit lighter than before so transmission lets real color through
    'Base Color':          (0.42, 0.18, 0.09, 1.0),
    'Metallic':            0.0,
    'Roughness':           0.06,
    'IOR':                 1.50,
    # Transmission needs modern Principled BSDF — Blender 4.x/5.x uses
    # 'Transmission Weight' (was 'Transmission' in 3.x). Set both defensively.
    'Transmission Weight': 0.88,
    'Transmission':        0.88,
    # Warm amber emission bias so the drop glows from within
    'Emission Color':      (0.92, 0.42, 0.14, 1.0),
    'Emission Strength':   0.4,
    # Wet-glaze top layer
    'Coat Weight':         0.8,
    'Coat Roughness':      0.03,
    'Coat IOR':            1.5,
    # Slight specular tint toward amber
    'Specular IOR Level':  0.55,
})

# Amber champagne glass — pearlescent bubbles
bubble_mat = build_material('BubbleGlassMat', {
    'Base Color':          (0.98, 0.80, 0.48, 1.0),
    'Metallic':            0.0,
    'Roughness':           0.05,
    'IOR':                 1.45,
    'Transmission Weight': 0.95,
    'Transmission':        0.95,
    'Emission Color':      (1.0, 0.85, 0.55, 1.0),
    'Emission Strength':   0.55,
    'Coat Weight':         0.7,
    'Coat Roughness':      0.02,
    'Coat IOR':            1.55,
})

# Iridescence if available (Blender 4+ Principled BSDF has Iridescence inputs)
def set_if_has(mat, key, val):
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf and key in bsdf.inputs:
        try: bsdf.inputs[key].default_value = val
        except Exception: pass

# Pearlescent shimmer on bubbles
set_if_has(bubble_mat, 'Iridescence',        0.7)
set_if_has(bubble_mat, 'Iridescence IOR',    1.33)
set_if_has(bubble_mat, 'Iridescence Weight', 0.7)

# ───────────────────────────────────────────────────────────────
# Assign materials by shape
# ───────────────────────────────────────────────────────────────
def is_bubble(obj):
    bb = obj.bound_box
    xs = [v[0] for v in bb]; ys = [v[1] for v in bb]; zs = [v[2] for v in bb]
    sx = max(xs) - min(xs); sy = max(ys) - min(ys); sz = max(zs) - min(zs)
    longest  = max(sx, sy, sz)
    shortest = min(sx, sy, sz)
    if longest == 0: return False
    aspect_ok = (shortest / longest) > 0.72
    small = longest < 1.3
    return aspect_ok and small

bubble_count = 0
for obj in meshes:
    obj.data.materials.clear()
    if is_bubble(obj):
        obj.data.materials.append(bubble_mat); bubble_count += 1
    else:
        obj.data.materials.append(drop_mat)
    for poly in obj.data.polygons:
        poly.material_index = 0
print(f'[mat] drops+spiral={len(meshes) - bubble_count}  bubbles={bubble_count}')

# ───────────────────────────────────────────────────────────────
# Global proportional decimate
# ───────────────────────────────────────────────────────────────
TRI_BUDGET = 90000
if total_tri > TRI_BUDGET:
    ratio = TRI_BUDGET / total_tri
    print(f'[mat] decimate ratio {ratio:.4f}')
    for obj in meshes:
        mod = obj.modifiers.new(name='PartDecimate', type='DECIMATE')
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)

print(f'[mat] exporting {out_path}')
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_materials='EXPORT',
    export_normals=True,
    export_texcoords=True,
    export_apply=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
)
print('[mat] done')
