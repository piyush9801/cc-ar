"""
High-quality chair export: keep more geometry + PNG textures + no
downscaling so the leather/metal reads like real material, not the
paper-stitched look the aggressive decimation caused.
Usage:
  blender --background --python export-chair-hq.py -- <in.glb> <out.usdz>
"""
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) != 2: sys.exit(1)
in_path, out_path = os.path.abspath(argv[0]), os.path.abspath(argv[1])

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=in_path)

# Decimate ONLY if over 500k tris — double the previous budget
TRI_BUDGET = 500000
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    tri = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tri <= TRI_BUDGET:
        continue
    ratio = TRI_BUDGET / tri
    print(f'[chair] decimate {obj.name}: {tri} → ~{TRI_BUDGET}')
    mod = obj.modifiers.new(name='ChairDec', type='DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

print(f'[chair] exporting {out_path}')
bpy.ops.wm.usd_export(
    filepath=out_path,
    selected_objects_only=False,
    export_animation=True,
    export_uvmaps=True,
    export_normals=True,
    export_materials=True,
    generate_preview_surface=True,
    export_textures_mode='NEW',
    overwrite_textures=True,
    relative_paths=True,
    convert_orientation=True,
    export_global_forward_selection='NEGATIVE_Z',
    export_global_up_selection='Y',
    convert_scene_units='METERS',
    meters_per_unit=1.0,
    # Keep full-res textures — no downscale
    usdz_downscale_size='KEEP',
    triangulate_meshes=True,
    quad_method='SHORTEST_DIAGONAL',
    ngon_method='BEAUTY',
)
print('[chair] done')
