"""
Rebuild all USDZ files from the lite GLBs so Apple's ARKit validator
accepts them. Fixes:
  - Missing upAxis  →  Blender sets Y-up on export
  - Missing defaultPrim  →  root Xform becomes default
  - MaterialBindingAPI missing  →  Blender exports applied API
  - Unsupported .webp / .hdr textures  →  JPEG on re-export
  - uvset varname token/string mismatch  →  Blender writes the right type

Run:
  blender --background --python rebuild-usdz.py
"""
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))

# (source GLB, out USDZ name)
JOBS = [
    ('janine-wave-matte.glb',       'janine-wave.usdz'),
    ('gilded-hair-spiral-lite.glb', 'gilded-hair-spiral.usdz'),
    ('midnight-curls-lite.glb',     'midnight-curls.usdz'),
    ('golden-chair.glb',            'golden-chair.usdz'),
    ('bottle-opt.glb',              'bottle-opt.usdz'),
    ('liquid-drop.glb',             'liquid-drop.usdz'),
    ('hair-ring-lite.glb',          'hair-ring.usdz'),
]

for src_name, out_name in JOBS:
    src = os.path.join(HERE, 'assets', src_name)
    out = os.path.join(HERE, 'assets', out_name)
    if not os.path.exists(src):
        print(f'[skip] {src_name} not found')
        continue

    print(f'\n===== {src_name} → {out_name} =====')
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

    # Blender's glTF import leaves an empty scene root. USD export
    # needs the up-axis set so ARKit treats the floor correctly.
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.length_unit = 'METERS'

    # Ensure there is a default prim in the exported stage: a single
    # top-level Xform with everything parented under it.
    bpy.ops.object.select_all(action='SELECT')
    if bpy.context.selected_objects:
        # Create a parent empty if needed
        roots = [o for o in bpy.context.scene.objects if o.parent is None]
        if len(roots) > 1:
            bpy.ops.object.empty_add(type='PLAIN_AXES')
            parent = bpy.context.active_object
            parent.name = 'Root'
            for o in roots:
                if o is parent: continue
                o.parent = parent

    try:
        bpy.ops.wm.usd_export(
            filepath=out,
            selected_objects_only=False,
            export_animation=True,
            export_hair=False,
            export_uvmaps=True,
            export_normals=True,
            export_materials=True,
            use_instancing=True,
            evaluation_mode='RENDER',
            generate_preview_surface=True,
            convert_orientation=True,   # Y-up
            export_global_forward_selection='NEGATIVE_Z',
            export_global_up_selection='Y',
            root_prim_path='/Root',
            usdz_downscale_size='CUSTOM',
            usdz_downscale_custom_size=1024,
            convert_scene_units='METERS',
            meters_per_unit=1,
        )
        size = os.path.getsize(out)
        print(f'  ok · {size/1024/1024:.1f}MB')
    except Exception as e:
        print(f'  [fail] {e}')
