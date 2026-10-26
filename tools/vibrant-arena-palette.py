"""Consistent vivid material families, pink ambience, and readable distant ruins."""
import bpy, json, tempfile, math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena-colour-light.blend'))
scene=bpy.context.scene;camera=scene.camera
families={
 'pillars':((.15,.025,.075),(.48,.135,.285)),
 'slabs':((.025,.014,.105),(.135,.065,.42)),
 'rocks':((.02,.023,.09),(.10,.095,.30)),
 'towers':((.035,.02,.12),(.19,.08,.40)),
 'foliage_props':((.075,.012,.065),(.29,.055,.205)),
}
notes=json.loads((OUT/'painted-atmosphere-notes.json').read_text())
group_counts={k:0 for k in families}
def family(name,obj):
    if obj=='Terrain_and_Floating_Rocks':return 'rocks'
    if name.startswith('Atmosphere_Tower'):return 'towers'
    # Shaft and capital belong to one pink architectural family.
    if name.startswith('pCylinder') or name=='pCube2' or name.startswith('pCube2.'):return 'pillars'
    if name in {'pCube8','pCube9','pCube10','pCube11','pCube6','pCube7','pCube4.002','pCube5.002'}:return 'rocks'
    if name.startswith(('pCube18','pCube14')) or name in {'pCube3','polySurface12','polySurface13'}:return 'slabs'
    return 'foliage_props'

for entry in notes['atlases']:
    name=entry['object'];o=bpy.data.objects[name];mesh=o.data
    groups={g.index:[] for g in o.vertex_groups}
    for v in mesh.vertices:
        for g in v.groups:
            if g.weight>.5:groups[g.group].append(v.index);break
    ordered=[]
    for g in o.vertex_groups:
        ids=groups[g.index]
        if not ids or g.name=='Rocky_Terrain':continue
        center=sum((o.matrix_world@mesh.vertices[i].co for i in ids),Vector())/len(ids)
        if (center-camera.location).length<32:ordered.append(g.name)
    # Use the original ink atlas as the mask, avoiding repeated colour edits.
    src=bpy.data.images.load(str(OUT/('Painted_'+name+'_Ink.png')),check_existing=True)
    src.colorspace_settings.name='Non-Color';w,h=src.size
    pixels=np.empty(w*h*4,dtype=np.float32);src.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
    cols=w//256;t=np.linspace(0,1,256)[:,None,None]
    for i,g in enumerate(ordered):
        tile=pixels[i//cols*256:(i//cols+1)*256,i%cols*256:(i%cols+1)*256,:3]
        category=family(g,name);group_counts[category]+=1
        low,high=map(np.array,families[category]);pigment=low*(1-t)+high*t
        # Preserve the dark brush cores and their soft edges exactly in place.
        coverage=np.clip((np.max(tile,axis=2,keepdims=True)-.012)/.025,0,1)
        tile[:]=pigment*coverage+tile*(1-coverage)
    img=bpy.data.images.new('Vibrant_'+name+'_Ink',width=w,height=h,alpha=False)
    img.colorspace_settings.name='Non-Color';img.pixels.foreach_set(pixels.ravel());img.update()
    img.filepath_raw=str(OUT/(img.name+'.png'));img.file_format='PNG';img.save();img.pack()
    for mat in mesh.materials:
        if mat and mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image and node.image.name.startswith('Chromatic_'):
                    node.image=img

# Deliberately distinct ring violet and platform lavender, independent of
# the pink columns and deep blue-violet connecting slabs.
for name,rgb in [('polySurface11',(.24,.12,.39)),('polySurface14',(.34,.065,.49)),
                 ('pTorus3',(.34,.065,.49)),('Terrain_and_Floating_Rocks',(.09,.075,.24))]:
    attr=bpy.data.objects[name].data.color_attributes.get('StylizedColor')
    if not attr:continue
    values=np.empty(len(attr.data)*4,dtype=np.float32);attr.data.foreach_get('color',values);values=values.reshape(-1,4)
    intensity=np.clip(np.max(values[:,:3],axis=1,keepdims=True)/.24,.35,1.3)
    values[:,:3]=np.array(rgb)*intensity;attr.data.foreach_set('color',values.ravel())

def light(name,kind,loc,color,power,radius,target=None,cone=2.5):
    bpy.ops.object.light_add(type=kind,location=loc);o=bpy.context.object;o.name=name
    o.data.color=color;o.data.energy=power;o.data.shadow_soft_size=radius
    if kind=='SPOT':o.data.spot_size=cone;o.data.spot_blend=.85
    if target:o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o

old=bpy.data.objects.get('Rose reflected light • foreground left')
if old:old.data.energy=95;old.data.color=(1,.20,.48)
light('Pink ambience • soft left-side wash','SPOT',(-5,-.5,4),(1,.22,.55),420,2.2,(0,1,.4))
light('Pink ambience • right-side rose bounce','POINT',(3.8,1.5,2.7),(1,.27,.57),95,1.7)
light('Lilac ambience • upper stone fill','POINT',(-1,3.5,5),(.65,.35,1),150,2.2)
light('Rear towers • lavender moon wash','SPOT',(-5,16,8),(.51,.39,1),1300,3,(0,20,2))
light('Rear towers • blue-violet separation','SPOT',(6,26,9),(.30,.35,1),1700,3,(0,30,2))
light('Rear towers • muted pink edge','POINT',(-7,22,4),(1,.30,.57),170,2.5)
fog=bpy.data.objects.get('Atmosphere • cool distant ruin haze')
if fog:
    volume=next(n for n in fog.data.materials[0].node_tree.nodes if n.type=='PRINCIPLED_VOLUME')
    volume.inputs['Density'].default_value=.006
    volume.inputs['Color'].default_value=(.30,.26,.46,1)
scene.view_settings.exposure=.35
scene.cycles.samples=80
scene.render.filepath=str(OUT/'arena-vibrant-palette.png');bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(o!=fog and (o.type in {'MESH','LIGHT'} or o==camera))
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena-vibrant-palette.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena-vibrant-palette.blend'))
(OUT/'vibrant-palette-notes.json').write_text(json.dumps({'families':families,'painted_parts_by_family':group_counts,'rings':'saturated violet','platform':'lavender','fog_density':.006,'previous_fog_density':.016,'changes':'consistent colours by component type, pink side ambience, rear tower illumination','layout_camera_geometry':'unchanged','runtime':'point/spot lights included; fog and bloom need runtime configuration'},indent=2))
