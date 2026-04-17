"""
Inspect materials of the golden-chair USDZ/GLB to see what went missing in conversion.
  blender --background --python inspect-chair.py
"""
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))

def inspect(path, label):
    print(f'\n===== {label}: {path} =====')
    bpy.ops.wm.read_homefile(use_empty=True)
    if path.endswith('.usdz') or path.endswith('.usd'):
        bpy.ops.wm.usd_import(filepath=path)
    else:
        bpy.ops.import_scene.gltf(filepath=path)
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type != 'BSDF_PRINCIPLED':
                continue
            print(f'  mat="{mat.name}"')
            for key in ['Base Color', 'Metallic', 'Roughness', 'Specular IOR Level', 'Specular', 'Coat Weight', 'Clearcoat']:
                if key in node.inputs:
                    v = node.inputs[key].default_value
                    linked = node.inputs[key].is_linked
                    # summarise color
                    if hasattr(v, '__len__'):
                        v = tuple(round(x, 3) for x in v)
                    print(f'    {key:22s} = {v}   linked={linked}')

inspect(os.path.join(HERE, 'assets', 'golden-chair.usdz'), 'USDZ source')
inspect(os.path.join(HERE, 'assets', 'golden-chair.glb'),  'GLB (current web asset)')
