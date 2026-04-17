"""Inspect a GLB to understand material/mesh/texture structure."""
import bpy, sys, os
argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if not argv: sys.exit(1)
in_path = os.path.abspath(argv[0])
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=in_path)

print(f'\n=== SCENE ===')
for o in bpy.context.scene.objects:
    print(f'  obj: {o.name} type={o.type}')
    if o.type == 'MESH':
        tri_count = sum(len(p.vertices) - 2 for p in o.data.polygons)
        print(f'    verts={len(o.data.vertices)}  tris={tri_count}  uv_layers={len(o.data.uv_layers)}')
        print(f'    material_slots={len(o.material_slots)}')
        for i, slot in enumerate(o.material_slots):
            m = slot.material
            if m:
                print(f'      slot[{i}]: {m.name}  use_nodes={m.use_nodes}')
                if m.use_nodes and m.node_tree:
                    for node in m.node_tree.nodes:
                        if node.type == 'TEX_IMAGE':
                            img = node.image
                            if img:
                                print(f'        TEX: {img.name}  size={img.size[0]}x{img.size[1]}  channels={img.channels}')
        # Bounding box
        bb = [o.matrix_world @ bpy.mathutils.Vector(c) for c in o.bound_box]
        ys = [v.z for v in bb]  # Z-up in Blender = Y-up in glTF
        print(f'    bounds Z: {min(ys):.2f} → {max(ys):.2f}')
