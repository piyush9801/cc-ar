"""
Reduce metallic + raise roughness on the janine-wave GLB so the model
stops reading waxy/glossy in model-viewer.

Run:
  blender --background --python matte-janine.py
"""
import bpy, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
IN_PATH  = os.path.join(HERE, 'assets', 'janine-wave.glb')
OUT_PATH = os.path.join(HERE, 'assets', 'janine-wave-matte.glb')

bpy.ops.wm.read_homefile(use_empty=True)
print(f'[matte] importing {IN_PATH}')
bpy.ops.import_scene.gltf(filepath=IN_PATH)

def walk(tree, fn):
    for node in tree.nodes:
        fn(node)

touched = 0
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    tree = mat.node_tree
    for node in tree.nodes:
        if node.type != 'BSDF_PRINCIPLED':
            continue
        # drop metallic to 0 (clothing + skin shouldn't read as chrome)
        if 'Metallic' in node.inputs:
            node.inputs['Metallic'].default_value = 0.0
        # slight roughness lift — keep surface variation intact
        if 'Roughness' in node.inputs:
            r = node.inputs['Roughness'].default_value
            node.inputs['Roughness'].default_value = max(r, 0.55)
        # default specular level (0.5 is neutral PBR)
        for spec_name in ('Specular', 'Specular IOR Level'):
            if spec_name in node.inputs:
                node.inputs[spec_name].default_value = 0.5
        # kill clearcoat (the hard glossy coat is what was reading as plastic shine)
        for cc_name in ('Clearcoat', 'Coat Weight'):
            if cc_name in node.inputs:
                node.inputs[cc_name].default_value = 0.0
        # kill sheen (what was making the silk glow)
        for sh_name in ('Sheen', 'Sheen Weight'):
            if sh_name in node.inputs:
                node.inputs[sh_name].default_value = 0.0
        touched += 1

print(f'[matte] touched {touched} principled nodes across {len(bpy.data.materials)} materials')

# Also bake any metallic/roughness texture contribution down by clamping
# via the gltf material settings — we'll rely on node edits above for glTF export.

print(f'[matte] exporting {OUT_PATH}')
bpy.ops.export_scene.gltf(
    filepath=OUT_PATH,
    export_format='GLB',
    export_image_format='AUTO',
    export_materials='EXPORT',
    export_animations=True,
    export_skins=True,
    export_morph=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
)
print('[matte] done')
