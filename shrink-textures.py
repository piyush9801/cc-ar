"""
Shrink embedded textures in the *-lite GLBs so they're phone-friendly.

Resizes every image down to max 1024px on the long edge and re-encodes
with glTF export quality 70. Input files are already decimated.

Run:
  blender --background --python shrink-textures.py
"""
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_DIM = 1024
QUALITY = 70

FILES = [
    'gilded-hair-spiral-lite.glb',
    'midnight-curls-lite.glb',
    'hair-ring-lite.glb',
    'janine-wave-matte.glb',
    'golden-chair.glb',
    'bottle-opt.glb',
    'liquid-drop.glb',
    'conditioner-new.glb',
    'cream-new.glb',
    'butterflies.glb',
]

def shrink_images():
    touched = 0
    for img in list(bpy.data.images):
        if img.size[0] == 0 or img.size[1] == 0:
            continue
        w, h = img.size
        long_edge = max(w, h)
        if long_edge <= MAX_DIM:
            continue
        ratio = MAX_DIM / long_edge
        nw = max(2, int(w * ratio))
        nh = max(2, int(h * ratio))
        try:
            img.scale(nw, nh)
            touched += 1
            print(f'    resized "{img.name}": {w}x{h} → {nw}x{nh}')
        except Exception as e:
            print(f'    [warn] scale failed on "{img.name}": {e}')
    return touched

for name in FILES:
    src = os.path.join(HERE, 'assets', name)
    if not os.path.exists(src):
        print(f'[skip] {name} not found')
        continue

    print(f'\n===== {name} =====')
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

    before = os.path.getsize(src)
    print(f'  images in: {len(bpy.data.images)}')
    n = shrink_images()
    print(f'  resized {n}/{len(bpy.data.images)}')

    # Overwrite in place
    bpy.ops.export_scene.gltf(
        filepath=src,
        export_format='GLB',
        export_image_format='JPEG',
        export_image_quality=QUALITY,
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
    after = os.path.getsize(src)
    print(f'  size: {before/1024/1024:.1f}MB → {after/1024/1024:.1f}MB  ({100*after/before:.0f}%)')
