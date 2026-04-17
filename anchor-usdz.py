"""
Stamp preliminary:anchoring metadata onto every USDZ so Apple's
Quick Look stops scanning the whole room — it just waits for a
horizontal plane and drops the model.

ARKit reads these tokens on the root prim and prefers them over
its default heuristic.  Without them, Quick Look tries to detect
planes AND feature points AND image anchors simultaneously which
takes several seconds and noticeable phone movement.

Run:
  python3 anchor-usdz.py
"""
import os, sys, zipfile, shutil, tempfile
from pxr import Usd, UsdGeom, Sdf, UsdUtils

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')

FILES = [
    'janine-wave.usdz',
    'gilded-hair-spiral.usdz',
    'midnight-curls.usdz',
    'golden-chair.usdz',
    'bottle-opt.usdz',
    'liquid-drop.usdz',
    'hair-ring.usdz',
]

def patch(usdz_path):
    print(f'\n=== {os.path.basename(usdz_path)} ===')
    # Unpack
    tmp = tempfile.mkdtemp(prefix='cc-usdz-')
    try:
        with zipfile.ZipFile(usdz_path) as zf:
            zf.extractall(tmp)
            entries = zf.namelist()

        # Find the root USD file (first .usdc or .usda at archive root)
        root = None
        for e in entries:
            if '/' not in e and e.endswith(('.usdc', '.usda', '.usd')):
                root = os.path.join(tmp, e); break
        if not root:
            print('  [skip] no root USD in archive')
            return
        print(f'  root: {os.path.basename(root)}')

        stage = Usd.Stage.Open(root)
        default = stage.GetDefaultPrim()
        if not default:
            roots = [p for p in stage.GetPseudoRoot().GetChildren()]
            if roots: default = roots[0]; stage.SetDefaultPrim(default)
        if not default:
            print('  [skip] no default prim'); return
        print(f'  default prim: {default.GetPath()}')

        # Tell Quick Look this is a plane-anchored model
        default.SetMetadata('kind', 'component')
        default.CreateAttribute('preliminary:anchoring:type', Sdf.ValueTypeNames.Token).Set('plane')
        default.CreateAttribute('preliminary:planeAnchoring:alignment', Sdf.ValueTypeNames.Token).Set('horizontal')

        # Make sure upAxis is Y
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)

        stage.GetRootLayer().Save()

        # Repack as USDZ using pxr's packer — it knows USDZ's 64-byte
        # alignment rules. Building with zipfile.ZipFile misaligns file
        # entries and Apple's usdchecker rejects the package.
        out = usdz_path + '.tmp'
        if os.path.exists(out): os.remove(out)
        ok = UsdUtils.CreateNewUsdzPackage(root, out)
        if not ok:
            print('  [fail] CreateNewUsdzPackage')
            return
        os.replace(out, usdz_path)
        size = os.path.getsize(usdz_path)
        print(f'  ok · {size/1024/1024:.1f}MB')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


for name in FILES:
    p = os.path.join(ASSETS, name)
    if os.path.exists(p):
        patch(p)
    else:
        print(f'[skip] {name} missing')
