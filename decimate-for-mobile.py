"""
Decimate the heavy GLBs so mobile Safari stops killing the tab.

Input models have 700k-3.6M tris — way over the ~100k ceiling mobile
WebGL contexts handle reliably. Exports *-lite.glb at ~8-12% of the
original poly count with Draco + JPEG texture compression.

Run:
  blender --background --python decimate-for-mobile.py
"""
import bpy, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# (source, out name, decimate ratio)
JOBS = [
    ('gilded-hair-spiral.glb', 'gilded-hair-spiral-lite.glb', 0.12),  # 709k → ~85k
    ('midnight-curls.glb',     'midnight-curls-lite.glb',     0.05),  # ~3.6M → ~180k
    ('hair-ring.glb',          'hair-ring-lite.glb',          0.12),  # 731k → ~88k
]

for src_name, out_name, ratio in JOBS:
    src = os.path.join(HERE, 'assets', src_name)
    out = os.path.join(HERE, 'assets', out_name)
    if not os.path.exists(src):
        print(f'[skip] {src_name} not found')
        continue

    print(f'\n===== {src_name} → {out_name} (ratio={ratio}) =====')
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

    # Collect meshes
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    total_before = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    print(f'[in] {len(meshes)} meshes · {total_before} tris')

    # Decimate each mesh
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new(name='cc_decimate', type='DECIMATE')
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        try:
            bpy.ops.object.modifier_apply(modifier='cc_decimate')
        except Exception as e:
            print(f'  [warn] apply failed on {o.name}: {e}')

    total_after = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    print(f'[out] {total_after} tris ({100 * total_after / max(1,total_before):.1f}%)')

    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        export_image_format='AUTO',
        export_image_quality=75,
        export_materials='EXPORT',
        export_animations=True,
        export_skins=True,
        export_morph=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=8,
        export_draco_position_quantization=12,
        export_draco_normal_quantization=8,
        export_draco_texcoord_quantization=10,
    )

    size_before = os.path.getsize(src)
    size_after = os.path.getsize(out)
    print(f'[size] {size_before / 1024 / 1024:.1f}MB → {size_after / 1024 / 1024:.1f}MB')

print('\nDone.')
