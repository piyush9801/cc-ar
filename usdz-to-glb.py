"""
Convert a USDZ file to GLB while preserving all animation tracks.
  blender --background --python usdz-to-glb.py -- <in.usdz> <out.glb>
"""
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) != 2: sys.exit(1)
in_path, out_path = os.path.abspath(argv[0]), os.path.abspath(argv[1])

bpy.ops.wm.read_homefile(use_empty=True)
print(f'[usdz→glb] importing {in_path}')
bpy.ops.wm.usd_import(filepath=in_path)

# Report what we got
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
total_tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
print(f'[usdz→glb] {len(meshes)} meshes · {len(armatures)} armatures · {total_tri} tris')
for a in armatures:
    if a.animation_data and a.animation_data.action:
        print(f'[usdz→glb]   action: {a.animation_data.action.name} · frames={a.animation_data.action.frame_range}')

print(f'[usdz→glb] exporting {out_path}')
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_image_format='AUTO',
    export_materials='EXPORT',
    export_normals=True,
    export_texcoords=True,
    export_animations=True,
    export_skins=True,
    export_morph=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
)
print('[usdz→glb] done')
