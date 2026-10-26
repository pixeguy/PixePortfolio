"""Open the debris canopy and vary emissive fractures on selected rear towers."""
import bpy, math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/poseidon-space-arena'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena.blend'))
scene=bpy.context.scene

# Fewer pieces, with clear gaps over the walkway and a higher, wider canopy.
rocks=sorted((o for o in scene.objects if o.get('arenaMotion')=='rock'),key=lambda o:o.name)
keep=[o for o in rocks if o.name.startswith('Arena_Floating_Rock') or o.name in
      ['Arena_Extra_Debris_03','Arena_Extra_Debris_06','Arena_Extra_Debris_11','Arena_Extra_Debris_12']]
positions=[(-7,-2,5.4),(8,1,7),(-5,5,6.8),(6,7,4.7),(-9,10,8),
           (9,13,6),(-5,16,5.5),(5,18,8),(-10,22,7),(10,25,5.5),
           (-7,28,9),(7,31,7),(-3,35,7.5),(4,39,9),(-12,6,6),(12,17,8.5),
           (-2,-4,8.2),(3,10,8.8),(-3,23,9.8),(2,29,10.5)]
for o in rocks:
    if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
for o,pos in zip(keep,positions):
    o.location=pos
    # Save an authored scale once so rerunning this script is stable.
    if 'spacedOriginalScale' not in o:o['spacedOriginalScale']=list(o.scale)
    o.scale=Vector(o['spacedOriginalScale'])*.82

arch=bpy.data.objects['Arena_Columns_Props_Towers'];mesh=arch.data
groups={g.index:set() for g in arch.vertex_groups}
for v in mesh.vertices:
    for g in v.groups:
        if g.weight>.5:groups[g.group].add(v.index);break
world=[arch.matrix_world@v.co for v in mesh.vertices]
uv=mesh.uv_layers.get('SharpFissureUV') or mesh.uv_layers.new(name='SharpFissureUV')
base=bpy.data.materials['Stylized • purple gradient stone']

def texture(name,paths):
    size=1024;px=np.ones((size,size,4),dtype=np.float32);px[:,:,:3]=0
    for path in paths:
        for a,b in zip(path,path[1:]):
            a=np.array(a)*(size-1);b=np.array(b)*(size-1);ab=b-a;width=1.6
            lo=np.maximum(0,np.floor(np.minimum(a,b)-4).astype(int));hi=np.minimum(size,np.ceil(np.maximum(a,b)+4).astype(int))
            yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]]
            t=np.clip(((xx-a[0])*ab[0]+(yy-a[1])*ab[1])/max(float(ab@ab),1e-8),0,1)
            d=np.sqrt((xx-a[0]-t*ab[0])**2+(yy-a[1]-t*ab[1])**2)
            region=px[lo[1]:hi[1],lo[0]:hi[0],:3]
            region[:]=np.maximum(region,np.array([1,.59,.12])*np.clip(width+.65-d,0,1)[:,:,None])
    im=bpy.data.images.new(name,width=size,height=size,alpha=False);im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(px.ravel());im.update();im.filepath_raw=str(OUT/(name+'.png'));im.file_format='PNG';im.save();im.pack();return im

main=[(.08,.62),(.22,.58),(.34,.64),(.46,.60),(.59,.66),(.74,.63),(.94,.69)]
branch=[(.46,.60),(.44,.48),(.49,.39),(.43,.31),(.46,.17)]
images=[texture('Rear_Tower_Fissure_Sparse',[main[1:5]]),
        texture('Rear_Tower_Fissure_Branched',[main,branch,[(.22,.58),(.25,.73),(.20,.84)]])]
selected={15:(0,.65),18:(1,.9),20:(0,.45),23:(1,.7),26:(1,1.05),29:(0,.8),31:(1,.6),33:(0,.7),35:(1,.55)}
for o in list(scene.objects):
    if o.name.startswith('Rear tower rune spill'):bpy.data.objects.remove(o,do_unlink=True)
for number,(pattern,strength) in selected.items():
    name=f'Atmosphere_Tower_{number:02d}';group=arch.vertex_groups[name];ids=groups[group.index]
    ps=[world[i] for i in ids];low=Vector(tuple(min(p[a] for p in ps) for a in range(3)));high=Vector(tuple(max(p[a] for p in ps) for a in range(3)));center=(low+high)*.5
    mat=base.copy();mat.name=f'Rear tower glowing fracture {number:02d}'
    nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
    for link in list(bs.inputs['Emission Color'].links):nt.links.remove(link)
    un=nt.nodes.new('ShaderNodeUVMap');un.uv_map=uv.name
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=images[pattern];tex.extension='REPEAT'
    nt.links.new(un.outputs['UV'],tex.inputs['Vector']);nt.links.new(tex.outputs['Color'],bs.inputs['Emission Color'])
    bs.inputs['Emission Strength'].default_value=strength
    slot=len(mesh.materials);mesh.materials.append(mat)
    for face in mesh.polygons:
        if not all(i in ids for i in face.vertices):continue
        face.material_index=slot;coords=[]
        for li in face.loop_indices:
            p=world[mesh.loops[li].vertex_index]
            coords.append((li,math.atan2(p.y-center.y,p.x-center.x)/math.tau+.5,(p.z-low.z)/max(.001,high.z-low.z)))
        seam=max(c[1] for c in coords)-min(c[1] for c in coords)>.5
        for li,u,v in coords:uv.data[li].uv=(u+1 if seam and u<.5 else u,v)
    loc=Vector((center.x*.93,center.y-1.3,low.z+(high.z-low.z)*.58))
    bpy.ops.object.light_add(type='POINT',location=loc);o=bpy.context.object;o.name=f'Rear tower rune spill {number:02d}'
    o.data.color=(1,.69,.25);o.data.energy=10*strength;o.data.shadow_soft_size=2
    o.data.use_custom_distance=True;o.data.cutoff_distance=6

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set((o.type=='MESH' and not o.name.startswith(('Hero_','Atmosphere •'))) or o.type=='LIGHT' or o==scene.camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_extras=True,export_animations=False)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena.blend'))
print('Spaced floating rocks:',len(keep),'Rear towers with new cracks:',list(selected))
