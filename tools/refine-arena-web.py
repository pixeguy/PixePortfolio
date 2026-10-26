"""Remove text-side glow/foreground rock and add two distant tower silhouettes."""
import bpy, bmesh, tempfile, json
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena.blend'));scene=bpy.context.scene
arch=bpy.data.objects['Arena_Columns_Props_Towers']

def indices(o,name):
    group=o.vertex_groups.get(name)
    if not group:return set()
    return {v.index for v in o.data.vertices if any(g.group==group.index and g.weight>.5 for g in v.groups)}

# Clear the affected architectural emission UV tiles, keeping other runes intact.
mat=next(m for m in arch.data.materials if m.name.startswith('Painted ink stone'))
node=next(n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and '_Emission' in n.image.name)
img=node.image;w,h=img.size;px=np.empty(w*h*4,dtype=np.float32);img.pixels.foreach_get(px);px=px.reshape(h,w,4)
uv=arch.data.uv_layers['PaintedInkUV'];cleared=[]
for name in ['pCylinder4.004','pCube2.004','pCube18']:
    ids=indices(arch,name)
    for face in arch.data.polygons:
        if ids and all(v in ids for v in face.vertices):
            p=uv.data[face.loop_start].uv
            x=int(p.x*w)//256*256;y=int(p.y*h)//256*256
            px[y:y+256,x:x+256,:3]=0;cleared.append(name);break
replacement=bpy.data.images.new('Painted_Architecture_Emission_NoTextSide',width=w,height=h,alpha=False)
replacement.colorspace_settings.name='Non-Color';replacement.pixels.foreach_set(px.ravel());replacement.update()
replacement.filepath_raw=str(OUT/'Painted_Arena_Columns_Props_Towers_Emission.png');replacement.file_format='PNG';replacement.save();replacement.pack();node.image=replacement
for light in list(scene.objects):
    if light.type=='LIGHT' and light.name.startswith('Fissure gold') and any(name in light.name for name in cleared):
        bpy.data.objects.remove(light,do_unlink=True)

# After pCube11 was removed, camera rays identify pCube7 directly behind it
# as the remaining lower-left protrusion. Remove only that visible island.
ids=indices(arch,'pCube7')
if ids:
    bm=bmesh.new();bm.from_mesh(arch.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[bm.verts[i] for i in ids],context='VERTS')
    bm.to_mesh(arch.data);bm.free();arch.data.update()

# Reuse one of the original low-poly towers with its existing UVs/materials.
source_group=next(g.name for g in arch.vertex_groups if g.name.startswith('Atmosphere_Tower_'))
source_ids=indices(arch,source_group)
for name,location,height in [('Distant_Opening_Tower_Left',(-1.6,13,-.55),4.8),('Distant_Opening_Tower_Right',(3.6,19,-.6),6.0)]:
    old=bpy.data.objects.get(name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    mesh=arch.data.copy();bm=bmesh.new();bm.from_mesh(mesh);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in source_ids],context='VERTS')
    bm.to_mesh(mesh);bm.free()
    points=[arch.matrix_world@v.co for v in mesh.vertices]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
    center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=height/(hi.z-lo.z)
    for v,p in zip(mesh.vertices,points):v.co=(p-center)*scale
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=location
    # Dark cool pigments remain readable against the sky without competing
    # with the close pink architecture or the name.
    material=bpy.data.materials.get('Distant towers • cool violet')
    if not material:
        material=bpy.data.materials.new('Distant towers • cool violet');material.use_nodes=True
        bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.085,.045,.20,1)
        bs.inputs['Roughness'].default_value=.96
    mesh.materials.clear();mesh.materials.append(material)
    for face in mesh.polygons:face.material_index=0
    light_name=name+' moonlight';old=bpy.data.objects.get(light_name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    bpy.ops.object.light_add(type='AREA',location=(location[0]-2,location[1]-2,height+2))
    lamp=bpy.context.object;lamp.name=light_name;lamp.data.type='SPOT';lamp.data.energy=700;lamp.data.color=(.48,.34,1)
    lamp.data.shadow_soft_size=2;lamp.data.spot_size=2.2;lamp.data.spot_blend=.8
    lamp.rotation_euler=(Vector(location)+Vector((0,0,height*.65))-lamp.location).to_track_quat('-Z','Y').to_euler()

fog=bpy.data.objects.get('Atmosphere • cool distant ruin haze')
if fog:
    next(n for n in fog.data.materials[0].node_tree.nodes if n.type=='PRINCIPLED_VOLUME').inputs['Density'].default_value=.003
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set((o.type=='MESH' and not o.name.startswith(('Hero_','Atmosphere •'))) or o.type=='LIGHT' or o==scene.camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena.blend'))
settings=json.loads((OUT/'arena-settings.json').read_text());settings.update({'fogDensity':.003,'removedForegroundRock':'pCube7','disabledTextSideFissures':['pCylinder4.004','pCube2.004','pCube18'],'addedDistantTowers':2,'runtimeCharacterAppearance':'outline only'})
(OUT/'arena-settings.json').write_text(json.dumps(settings,indent=2))
