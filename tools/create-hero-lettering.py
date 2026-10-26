"""Extruded Arial Bold glyphs for the home title, exported as real mesh geometry."""
import bpy,math,tempfile
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parent.parent
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.read_factory_settings(use_empty=True)
font=bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')
def material(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=.82
    return m
face=material('Lettering • warm gold face',(.66,.56,.10))
side=material('Lettering • plum cut sides',(.11,.055,.095))
for word in ['Zhan','Feng']:
    for index,char in enumerate(word):
        curve=bpy.data.curves.new('Extruded '+char,'FONT');curve.body=char;curve.font=font
        curve.size=1;curve.extrude=.085;curve.bevel_depth=.003;curve.bevel_resolution=1;curve.resolution_u=8
        o=bpy.data.objects.new(f'HeroGlyph_{word}_{index}',curve);bpy.context.collection.objects.link(o)
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.convert(target='MESH');o=bpy.context.object
        # Text baseline remains at Z=0; front faces point toward Blender -Y
        # (glTF +Z), with all extrusion behind the front plane.
        o.data.transform(Matrix.Rotation(math.pi/2,4,'X'))
        front=min(v.co.y for v in o.data.vertices)
        for v in o.data.vertices:v.co.y-=front
        o.data.materials.clear();o.data.materials.append(face);o.data.materials.append(side)
        for p in o.data.polygons:p.material_index=0 if p.normal.y<-.95 else 1
        o['heroGlyphWord']=word;o['heroGlyphIndex']=index
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/hero-lettering.glb'),export_format='GLB',use_selection=True,export_extras=True,export_animations=False)
