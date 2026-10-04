"""Editable showroom illustrations. Run Blender --background --python this_file -- --asset dna.

The hero is animated with live geometry in DnaStage.tsx; this scene supplies its
WebGL fallback and the exhibition illustrations. Meshy supplies the microscope.
"""
import argparse
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--asset', choices=['dna', 'lab', 'cell', 'notes'], required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
root = Path(__file__).resolve().parents[2]
raw = root / 'art-raw' / 'showroom'
raw.mkdir(parents=True, exist_ok=True)


def linear(color):
    rgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)


def material(name, color, metal=.15, roughness=.3):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear(color), 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*linear(color), 1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Coat Weight'].default_value = .3
    return mat


def apply(obj, mat):
    obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj


sphere_meshes = {}


def ball(pos, radius, mat, scale=(1, 1, 1)):
    if mat.name not in sphere_meshes:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1)
        obj = apply(bpy.context.object, mat)
        sphere_meshes[mat.name] = obj.data
    else:
        obj = bpy.data.objects.new('Molecular bead', sphere_meshes[mat.name])
        bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.scale = tuple(radius * axis for axis in scale)
    return obj


def tube(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, coord in zip(spline.points, points):
        point.co = (*coord, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    apply(obj, mat)
    return obj


def box(name, pos, scale, mat, bevel=.10, rotate=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = rotate
    modifier = obj.modifiers.new('Soft corners', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 4
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return apply(obj, mat)


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_x = 960 if args.asset == 'dna' else 720
scene.render.resolution_y = 1200 if args.asset == 'dna' else 720
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (*linear('#a398bc'), 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
violet = material('Lavender ceramic', '#b39aee', .4)
gold = material('Champagne brass', '#edc38a', .65, .24)
mint = material('Mint glass clay', '#9cdcc9', .2)
rose = material('Rose clay', '#dfa7ba', .15)
ivory = material('Warm ivory', '#e7dce7', .05, .4)
base = material('Violet pedestal', '#433254', .25)


def pedestal(radius=1.9, z=-1.4):
    bpy.ops.mesh.primitive_cylinder_add(vertices=80, radius=radius, depth=.24, location=(0, 0, z))
    obj = apply(bpy.context.object, base)
    bevel = obj.modifiers.new('Round edge', 'BEVEL')
    bevel.width = .08
    bevel.segments = 3
    bpy.ops.mesh.primitive_torus_add(major_radius=radius * .96, minor_radius=.028, location=(0, 0, z + .13))
    apply(bpy.context.object, gold)


if args.asset == 'dna':
    dna_materials = [material('Template strand', '#8766c5', .08, .48), material('Coding strand', '#b29bdb', .08, .48)]
    protein_materials = [material(f'Protein surface {i}', color, .08, .48) for i, color in enumerate(['#f4bd54', '#ef933d', '#f8ce69', '#dc763b'])]
    protein = material('RNA polymerase core', '#edab50', .08, .48)
    ntp = material('RNA nucleotides', '#f0787d', .08, .48)
    factor = material('Transcription factors', '#5ebbaa', .08, .48)
    base_materials = [material(f'Nucleotide base {i}', color, .04, .46) for i, color in enumerate(['#ad8fdd', '#65bea8', '#dd98b5', '#edba68'])]

    # THREE uses Y up. Preserve the live scene's coordinates in Blender's Z-up frame.
    def xyz(point):
        x, y, z = point
        return (x, -z, y)

    def dna_point(s, strand):
        opening = math.exp(-((s - .17) / .13) ** 4) * .24
        angle = s * math.pi * 5.5 + strand * math.pi
        radius = 1.06 * (1 - opening * .86)
        return (math.cos(angle) * radius + (1 if strand else -1) * opening * .72 + math.sin(s * math.pi * 1.4) * .28,
                (s - .5) * 8.6, math.sin(angle) * radius)

    coords = []
    for strand, mat in enumerate(dna_materials):
        points = []
        for i in range(191):
            pos = xyz(dna_point(i / 190, strand))
            points.append(pos)
            ball(pos, .095, mat)
        coords.append(points)
        tube('DNA backbone', points, .068, mat)
    for i in range(36):
        index = round((i + .5) / 36 * 190)
        a, b = coords[0][index], coords[1][index]
        middle = tuple((x + y) / 2 for x, y in zip(a, b))
        tube('Base pair A', [a, middle], .072, mint)
        tube('Base pair B', [middle, b], .072, rose)
    for radius, z in [(1.85, -4.7), (1.55, -4.8)]:
        bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=.025, location=(0, 0, z))
        apply(bpy.context.object, gold)
    template = dna_point(.17, 0)
    center = (template[0] + .25, template[1], template[2] + .45)
    lobes = [
        [-.68, .08, .02, .68, .93, .62], [.68, .16, .02, .66, .84, .62],
        [.04, -.63, -.2, .92, .48, .66], [-.48, .73, -.14, .44, .38, .5],
        [.53, .70, -.16, .43, .37, .45], [.04, -.1, -.55, .87, .84, .36]
    ]
    for lobe, (x, y, z, sx, sy, sz) in enumerate(lobes):
        ball(xyz(tuple(center[j] + [x, y, z][j] * 1.07 for j in range(3))), 1, protein, (sx * 1.07, sz * 1.07, sy * 1.07))
        for i in range(190):
            latitude = max(-.995, min(.995, 1 - 2 * (i + .5) / 190 + math.sin(i * 11.79) * .045))
            longitude = i * 2.39996 + lobe + math.sin(i * 8.31) * .13
            ring = math.sqrt(1 - latitude ** 2)
            jitter = 1 + math.sin(i * 13.37 + lobe) * .08
            local = (x + sx * ring * math.cos(longitude) * jitter,
                     y + sy * latitude * jitter,
                     z + sz * ring * math.sin(longitude) * jitter)
            pos = xyz(tuple(center[j] + local[j] * 1.07 for j in range(3)))
            radius = (.068 + (math.sin(i * 7.23) + 1) / 2 * .076) * 1.07
            color = math.floor((math.sin(i * 9.23 + lobe) + 1) * 1.99)
            ball(pos, radius, protein_materials[color], (1, .9, 1.1))
    for strand in range(2):
        side = 1 if strand else -1
        x, y, z = dna_point(.11, strand)
        x += side * .42
        z += .25
        for ox, oz, radius in [(0, 0, .36), (side * .22, .28, .27), (-side * .17, -.25, .25)]:
            ball(xyz((x + ox, y + oz, z)), radius, factor, (1, .8, 1))
            for i in range(22):
                angle = i * 2.39996
                height = 1 - 2 * (i + .5) / 22
                ring = math.sqrt(1 - height ** 2)
                ball(xyz((x + ox + ring * math.cos(angle) * radius, y + oz + height * radius, z + ring * math.sin(angle) * radius * .8)), .065, factor)
    for i in range(24):
        angle = i * 2.39996
        radius = 2.4 + (i % 5) * .34
        x, y, z = math.cos(angle) * radius, -3.4 + (i / 24) * 7.2, math.sin(angle) * 1.5
        ball(xyz((x, y, z)), .085, ntp)
        ball(xyz((x - .17, y, z)), .065, base_materials[i % 4], (1.8, .8, .8))
elif args.asset == 'lab':
    model = root / 'art-raw' / '3d' / 'microscope.glb'
    if not model.exists():
        raise FileNotFoundError(f'Meshy microscope missing: {model}')
    bpy.ops.import_scene.gltf(filepath=str(model))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    vertices = [o.matrix_world @ Vector(corner) for o in meshes for corner in o.bound_box]
    lo = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
    center = (lo + hi) * .5
    scale = 3.2 / max(hi - lo)
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
        obj.location = (obj.location - center) * scale
        obj.scale *= scale
        obj.location.z += .3
    pedestal(z=-1.5)
elif args.asset == 'cell':
    pedestal(z=-1.45)
    # Open cell membrane, nucleus, and organelles, expressed as a clay miniature.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1.55)
    obj = bpy.context.object
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > .3 and v.co.y < .65], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    apply(obj, mint)
    solid = obj.modifiers.new('Cell wall thickness', 'SOLIDIFY')
    solid.thickness = .12
    ball((-.15, .05, .12), .64, violet)
    ball((-.2, -.48, .3), .18, gold)
    for pos, angle in [((.8, -.4, -.1), .6), ((-.8, -.2, -.35), -.7), ((.5, .7, .35), .3)]:
        obj = ball(pos, .33, rose, (1.4, .65, .6))
        obj.rotation_euler.z = angle
    for i in range(6):
        s = i * .36
        tube('Endoplasmic loop', [(math.cos(t) * (.5 + s / 8) + .1, math.sin(t) * (.5 + s / 8) + .1, -.6 + s / 5) for t in [j / 24 * math.pi * 1.1 for j in range(25)]], .04, ivory)
    for pos in [(1.0, .2, .35), (-.8, .6, .45), (.8, -.65, .1), (-.65, -.8, .05)]:
        ball(pos, .12, gold)
elif args.asset == 'notes':
    pedestal(z=-1.3)
    for i, (mat, angle) in enumerate([(violet, -.12), (mint, .13), (rose, -.05)]):
        z = -1.0 + i * .36
        box('Blank book cover', (0, 0, z), (2.5, 1.8, .34), mat, .10, angle)
        box('Ivory page block', (.07, -.08, z + .015), (2.28, 1.66, .22), ivory, .04, angle)
        box('Top cover', (0, 0, z + .16), (2.5, 1.8, .06), mat, .03, angle)
    tube('Golden pencil', [(-1.1, -.6, .3), (.75, .75, .3)], .07, gold)
    ball((.05, .1, .5), .27, mint)
    for strand, mat in enumerate([violet, gold]):
        tube('Tiny DNA ornament', [(math.cos(i / 32 * math.pi * 3 + strand * math.pi) * .18 + .72, math.sin(i / 32 * math.pi * 3 + strand * math.pi) * .18 + .15, i / 32 * 1.4 + .2) for i in range(33)], .045, mat)

for name, loc, energy, color, size in [
    ('Softbox', (4, -6, 8), 1300, '#fff0d7', 7),
    ('Violet rim', (-5, 2, 6), 1600, '#d4bbff', 5),
    ('Front fill', (-3, -4, 1), 600, '#cdebe6', 5)
]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.color = linear(color)
    data.shape = 'DISK'
    data.size = size
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = loc
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat('-Z', 'Y').to_euler()

bpy.ops.object.camera_add(location=(5, -13, 5) if args.asset == 'dna' else (5, -8, 5.5))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, -.15)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 11.5 if args.asset == 'dna' else 5.6
scene.camera = camera
scene.render.filepath = str(raw / f'{args.asset}.png')
bpy.ops.wm.save_as_mainfile(filepath=str(raw / f'{args.asset}.blend'))
bpy.ops.render.render(write_still=True)
