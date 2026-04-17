"""
Convert a GLB file to USDZ for iOS AR Quick Look.

Runs under Blender's embedded Python (`blender --background --python glb-to-usdz.py -- <in.glb> <out.usdz>`).

Steps:
  1. Wipe the default scene
  2. Import the GLB
  3. Export as USDZ with settings tuned for AR Quick Look
"""

import bpy
import sys
import os

# Blender passes "--" then script args. Everything after "--" is for us.
argv = sys.argv
argv = argv[argv.index('--') + 1:] if '--' in argv else []
if len(argv) != 2:
    print(f'Usage: blender --background --python glb-to-usdz.py -- <in.glb> <out.usdz>')
    sys.exit(1)

in_path  = os.path.abspath(argv[0])
out_path = os.path.abspath(argv[1])

if not os.path.exists(in_path):
    print(f'Input not found: {in_path}')
    sys.exit(2)

# Clear the default scene
bpy.ops.wm.read_homefile(use_empty=True)

# Import GLB
print(f'[convert] importing {in_path}')
bpy.ops.import_scene.gltf(filepath=in_path)

# Unitize: AR Quick Look expects meters. glTF is already meters, so no scaling needed.
# Apply all transforms so they bake into the geometry.
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for obj in meshes:
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
try:
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
except Exception as e:
    print(f'[convert] transform_apply skipped: {e}')

# Decimate high-poly meshes — Draco decode often yields 500k+ triangles
# which bloats the USDZ beyond what AR Quick Look should download.
# Target ~80k triangles per mesh; quality hit is invisible at phone scale.
TRIANGLE_BUDGET = 80000
for obj in meshes:
    tri_count = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tri_count <= TRIANGLE_BUDGET:
        continue
    ratio = TRIANGLE_BUDGET / tri_count
    print(f'[convert] decimating {obj.name}: {tri_count} → ~{TRIANGLE_BUDGET} (ratio {ratio:.3f})')
    mod = obj.modifiers.new(name='AR_Decimate', type='DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception as e:
        print(f'[convert] decimate failed on {obj.name}: {e}')

print(f'[convert] exporting {out_path}')
# Blender's USD exporter writes USDZ when the extension is .usdz.
# Only the settings that consistently work across Blender 4.x/5.x are set
# here — anything platform-specific is left as default.
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
    # Y-up matches AR Quick Look's expectations
    convert_orientation=True,
    export_global_forward_selection='NEGATIVE_Z',
    export_global_up_selection='Y',
    # Scale-to-meters for iOS AR; glTF is already meters
    convert_scene_units='METERS',
    meters_per_unit=1.0,
    # Keep USDZ filesize reasonable for mobile by downscaling oversized textures
    usdz_downscale_size='CUSTOM',
    usdz_downscale_custom_size=1024,
    # Triangulate quads to keep Quick Look happy
    triangulate_meshes=True,
    quad_method='SHORTEST_DIAGONAL',
    ngon_method='BEAUTY',
)

print(f'[convert] done: {out_path}')
