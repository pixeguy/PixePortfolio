"""Brighter blue/violet and rose stone, with motivated soft magical lighting.

Keeps the painted ink, fissure masks, meshes and composed camera intact.
All authored lights are glTF-compatible point/spot lights.
"""
import bpy, math, random, tempfile, json
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena-painted-atmosphere.blend'))
scene=bpy.context.scene;camera=scene.camera
palettes=[((.055,.037,.13),(.25,.17,.37)),
          ((.04,.055,.14),(.18,.25,.40)),
          ((.075,.035,.105),(.31,.16,.29)),
          ((.05,.04,.13),(.24,.21,.38))]
notes=json.loads((OUT/'painted-atmosphere-notes.json').read_text())
for entry in notes['atlases']:
    name=entry['object'];mesh=bpy.data.objects[name].data
    old=bpy.data.images.get('Painted_'+name+'_Ink')
    w,h=old.size; pixels=np.empty(w*h*4,dtype=np.float32);old.pixels.foreach_get(pixels)
    pixels=pixels.reshape(h,w,4);size=256;cols=w//size
    # Identical UV tile ordering to the painted source; the ink pixels stay put.
    for i in range(entry['painted_parts']):
        y=i//cols*size;x=i%cols*size;tile=pixels[y:y+size,x:x+size,:3]
        rng=random.Random(518+i)
        low,high=map(np.array,palettes[rng.randrange(len(palettes))])
        t=np.linspace(0,1,size)[:,None,None]
        pigment=(low*(1-t)+high*t)*rng.uniform(.88,1.08)
        # Preserve soft ink antialiasing as well as the near-black core.
        ink=np.clip(np.max(tile,axis=2,keepdims=True)/.036,0,1)
        tile[:]=pigment*ink+tile*(1-ink)
    img=bpy.data.images.new('Chromatic_'+name+'_Ink',width=w,height=h,alpha=False)
    img.colorspace_settings.name='Non-Color';img.pixels.foreach_set(pixels.ravel());img.update()
    img.filepath_raw=str(OUT/(img.name+'.png'));img.file_format='PNG';img.save();img.pack()
    for material in mesh.materials:
        if not material or not material.use_nodes:continue
        for node in material.node_tree.nodes:
            if node.type=='TEX_IMAGE' and node.image==old:node.image=img

# Bring the platform/terrain into the same family, without erasing the bands.
for name in ['polySurface11','polySurface14','pTorus3','Terrain_and_Floating_Rocks']:
    mesh=bpy.data.objects[name].data;attr=mesh.color_attributes.get('StylizedColor')
    if attr:
        data=np.empty(len(attr.data)*4,dtype=np.float32);attr.data.foreach_get('color',data)
        data=data.reshape(-1,4);data[:,:3]*=np.array((1.45,1.6,1.65))
        attr.data.foreach_set('color',data.ravel())

# Rebuild the light rig. Source-sized soft shadows keep these broad light
# pools gentle; spot/point definitions also survive KHR_lights_punctual export.
for o in list(scene.objects):
    if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
def light(name,kind,loc,color,power,radius,target=None,cone=2.2):
    bpy.ops.object.light_add(type=kind,location=loc);o=bpy.context.object;o.name=name
    o.data.color=color;o.data.energy=power;o.data.shadow_soft_size=radius
    if kind=='SPOT':o.data.spot_size=cone;o.data.spot_blend=.8
    if target:o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o
light('Blue-violet sky • soft upper key','SPOT',(-4,1,7),(.48,.57,1),680,2.2,(0,1,0))
light('Blue sky • rear-left geometry reveal','SPOT',(-4,7,5),(.26,.41,1),800,2.5,(-1,0,.6),2.5)
light('Violet sky • rear-right rim','SPOT',(4,5,5),(.56,.29,1),640,2,(0,0,1),2.4)
light('Lavender sky • gentle front visibility','POINT',(-1,-3.5,4),(.55,.54,.85),110,2.5)
light('Rose reflected light • foreground left','POINT',(-3.5,-.7,2.4),(.85,.33,.60),48,1.5)
light('Distant blue ruin light','SPOT',(0,15,6),(.33,.43,.8),380,2,(0,9,0),2.4)

light('Character gold • broad platform pool','POINT',(0,-.15,.5),(1,.48,.13),82,.9)
light('Character outline • chest spill','POINT',(-.33,-.5,1.8),(1,.46,.16),25,.65)
light('Character outline • shoulder spill','POINT',(.3,-.1,2.8),(1,.49,.18),14,.5)
light('Character outline • near foot bounce','POINT',(-.45,-.5,.18),(1,.43,.10),12,.35)
for x in [-1.05,1.05]:
    light('Ring gold • broad lower stone wash','POINT',(x,1.85,.55),(1,.40,.10),25,.55)
    light('Ring gold • warm upper rune wash','POINT',(x*.8,1.85,1.65),(1,.43,.13),18,.5)

arch=bpy.data.objects['Arena_Columns_Props_Towers']
for group_name in notes['atlases'][0]['emissive_architecture']:
    group=arch.vertex_groups.get(group_name)
    points=[arch.matrix_world@v.co for v in arch.data.vertices if any(g.group==group.index for g in v.groups)]
    center=sum(points,Vector())/len(points)
    # Forward offset places the light outside the solid stone surface.
    center.y-=.27
    light('Fissure gold • soft stone illumination '+group_name,'POINT',center,(1,.42,.13),10,.42)

scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.008,.006,.027,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.22
fog=bpy.data.objects.get('Atmosphere • cool distant ruin haze')
if fog:
    volume=next(n for n in fog.data.materials[0].node_tree.nodes if n.type=='PRINCIPLED_VOLUME')
    volume.inputs['Density'].default_value=.016
    volume.inputs['Color'].default_value=(.28,.31,.48,1)
scene.view_settings.exposure=.2
scene.cycles.samples=80
scene.render.filepath=str(OUT/'arena-colour-light.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(o!=fog and (o.type in {'MESH','LIGHT'} or o==camera))
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena-colour-light.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena-colour-light.blend'))
(OUT/'colour-light-notes.json').write_text(json.dumps({'palette':'related lavender, rose-purple, slate-blue and violet pigments','ink':'original painted albedo ink retained','lighting':'soft cool rear/key lights, gentle foreground visibility, local warm rune and character spill','glb':'all point/spot lights included; runtime bloom and fog required','source':'arena-painted-atmosphere.blend','models_placements_camera':'unchanged'},indent=2))
