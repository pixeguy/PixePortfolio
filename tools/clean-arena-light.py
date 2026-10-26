"""Clean flat pigments, sharp emissive fissures, centred rail glyphs, soft spill."""
import bpy, math, tempfile
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena.blend'));scene=bpy.context.scene

# Remove the specifically rejected small rune blocks and their light pools.
for o in list(scene.objects):
    if o.name.startswith(('Rear rune stone','Rear magic','Soft rune spill')) or (o.type=='LIGHT' and 'ring' in o.name.lower() and 'gold' in o.name.lower()):
        bpy.data.objects.remove(o,do_unlink=True)

# Restore uninterrupted flat colour gradients in every currently used ink atlas.
images={}
for o in scene.objects:
    if o.type!='MESH':continue
    for mat in o.data.materials:
        if not mat or not mat.use_nodes:continue
        for node in mat.node_tree.nodes:
            if node.type=='TEX_IMAGE' and node.image and 'Ink' in node.image.name and not node.image.name.startswith('Rear_Runestone'):
                images[node.image.name]=node.image
for im in images.values():
    w,h=im.size;px=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(px);px=px.reshape(h,w,4)
    for y in range(0,h,256):
        for x in range(0,w,256):
            tile=px[y:y+256,x:x+256,:3]
            tile[:]=np.median(tile,axis=1,keepdims=True)
    # A loaded packed image can retain its old packed PNG after pixels/save().
    # Replace the datablock so the exporter receives the cleaned pixels too.
    clean=bpy.data.images.new('Clean_Ink_'+('Architecture' if 'Arena' in im.name or 'Architecture' in im.name else 'Terrain'),width=w,height=h,alpha=False)
    clean.colorspace_settings.name='Non-Color';clean.pixels.foreach_set(px.ravel());clean.update()
    clean.filepath_raw=str(OUT/Path(im.filepath_raw).name);clean.file_format='PNG';clean.save();clean.pack()
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        for node in mat.node_tree.nodes:
            if node.type=='TEX_IMAGE' and node.image==im:node.image=clean

def stroke(tile,path,width,color):
    hh,ww=tile.shape[:2]
    for a,b in zip(path,path[1:]):
        a=np.array(a)*[ww-1,hh-1];b=np.array(b)*[ww-1,hh-1]
        lo=np.maximum(0,np.floor(np.minimum(a,b)-width-1).astype(int));hi=np.minimum([ww,hh],np.ceil(np.maximum(a,b)+width+1).astype(int))
        if np.any(hi<=lo):continue
        yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]];ab=b-a
        t=np.clip(((xx-a[0])*ab[0]+(yy-a[1])*ab[1])/max(float(ab@ab),1e-8),0,1)
        d=np.sqrt((xx-a[0]-t*ab[0])**2+(yy-a[1]-t*ab[1])**2)
        region=tile[lo[1]:hi[1],lo[0]:hi[0],:3]
        region[:]=np.maximum(region,np.array(color)*np.clip(width+.65-d,0,1)[:,:,None])
def image(name,px):
    h,w=px.shape[:2];im=bpy.data.images.new(name,width=w,height=h,alpha=False)
    im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(px.ravel());im.update()
    im.filepath_raw=str(OUT/(name+'.png'));im.file_format='PNG';im.save();im.pack();return im

glyphs=[
 [[(.25,.16),(.25,.84),(.73,.57),(.25,.44)]],
 [[(.22,.22),(.5,.82),(.78,.22)],[(.34,.47),(.67,.47)]],
 [[(.25,.8),(.73,.8),(.4,.47),(.73,.17)],[(.4,.47),(.25,.17)]],
 [[(.5,.13),(.5,.87)],[(.25,.63),(.5,.42),(.76,.63)]],
 [[(.2,.25),(.5,.8),(.8,.25),(.2,.25)],[(.5,.25),(.5,.1)]],
 [[(.24,.18),(.24,.82),(.75,.59),(.24,.4)],[(.24,.4),(.71,.18)]],
]
rail=np.ones((256,4096,4),dtype=np.float32);rail[:,:,:3]=0
for i in range(20):
    x=int((i+.5)*4096/20)
    for path in glyphs[i%6]:stroke(rail[48:208,x-48:x+48],path,2.5,(1,.64,.17))
rail_image=image('Walkway_Inner_Rail_Runes',rail)
for mat in bpy.data.materials:
    if mat.use_nodes and mat.name.startswith('Walkway rune'):
        for node in mat.node_tree.nodes:
            if node.type=='TEX_IMAGE' and node.image and node.image.name.startswith('Walkway_Inner_Rail_Runes'):node.image=rail_image

arch=bpy.data.objects['Arena_Columns_Props_Towers'];mesh=arch.data
groups={g.index:set() for g in arch.vertex_groups}
for v in mesh.vertices:
    for g in v.groups:
        if g.weight>.5:groups[g.group].add(v.index);break
positions=[arch.matrix_world@v.co for v in mesh.vertices]
base=next(m for m in mesh.materials if m.name.startswith('Painted ink stone'))
em=next(n.image for n in base.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and '_Emission' in n.image.name)
w,h=em.size;px=np.empty(w*h*4,dtype=np.float32);em.pixels.foreach_get(px);px=px.reshape(h,w,4)
uv=mesh.uv_layers['PaintedInkUV'];selected=[];rear=[]
for g in arch.vertex_groups:
    ids=groups[g.index]
    if not ids:continue
    center=sum((positions[i] for i in ids),Vector())/len(ids)
    if g.name.startswith('pCylinder') and 11.5<center.y<17 and 1<abs(center.x)<3:rear.append(g.name)
    if g.name.startswith('pCube18'):continue
    for face in mesh.polygons:
        if all(i in ids for i in face.vertices) and mesh.materials[face.material_index].name.startswith('Sharp emissive fissure'):
            selected.append(g.name);break
        if all(i in ids for i in face.vertices) and mesh.materials[face.material_index]==base:
            p=uv.data[face.loop_start].uv;x=int(p.x*w)//256*256;y=int(p.y*h)//256*256
            if px[y:y+256,x:x+256,:3].max()>.04:selected.append(g.name)
            break
selected=list(dict.fromkeys(selected+rear[::2][:4]))
patterns=[]
for index in range(4):
    tex=np.ones((1024,1024,4),dtype=np.float32);tex[:,:,:3]=0
    paths=[[(.06,.68),(.23,.64),(.39,.67),(.49,.61),(.67,.66),(.79,.73),(.96,.7)],
           [(.49,.61),(.46,.49),(.49,.39),(.44,.28),(.47,.12)],
           [(.23,.64),(.28,.77),(.25,.91)],[(.46,.49),(.33,.42),(.29,.32)]]
    for k,path in enumerate(paths):
        path=[(1-u if index%2 else u,max(.03,min(.97,v+(index-1.5)*.035))) for u,v in path]
        stroke(tex,path,1.9 if k==0 else 1.45,(1,.59,.12))
    patterns.append(image(f'Sharp_Gold_Fissure_{index+1}',tex))
sharp_uv=mesh.uv_layers.get('SharpFissureUV') or mesh.uv_layers.new(name='SharpFissureUV')
for index,name in enumerate(selected):
    g=arch.vertex_groups[name];ids=groups[g.index];ps=[positions[i] for i in ids]
    low=Vector(tuple(min(p[a] for p in ps) for a in range(3)));high=Vector(tuple(max(p[a] for p in ps) for a in range(3)));center=(low+high)*.5
    mat=base.copy();mat.name='Sharp emissive fissure • '+name;nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
    for link in list(bs.inputs['Emission Color'].links):nt.links.remove(link)
    un=nt.nodes.new('ShaderNodeUVMap');un.uv_map=sharp_uv.name
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=patterns[index%4];tex.extension='REPEAT'
    nt.links.new(un.outputs['UV'],tex.inputs['Vector']);nt.links.new(tex.outputs['Color'],bs.inputs['Emission Color'])
    bs.inputs['Emission Strength'].default_value=.55 if name.startswith('Atmosphere') else 5
    slot=len(mesh.materials);mesh.materials.append(mat)
    cylindrical=name.startswith(('pCylinder','Atmosphere'))
    for face in mesh.polygons:
        if not all(i in ids for i in face.vertices):continue
        face.material_index=slot
        coords=[]
        for li in face.loop_indices:
            p=positions[mesh.loops[li].vertex_index]
            u=(math.atan2(p.y-center.y,p.x-center.x)/math.tau+.5) if cylindrical else ((p.x-low.x)/max(.001,high.x-low.x))
            coords.append((li,u,(p.z-low.z)/max(.001,high.z-low.z)))
        seam=cylindrical and max(c[1] for c in coords)-min(c[1] for c in coords)>.5
        for li,u,v in coords:sharp_uv.data[li].uv=(u+1 if seam and u<.5 else u,v)

def light(name,loc,energy,radius):
    bpy.ops.object.light_add(type='POINT',location=loc);o=bpy.context.object;o.name=name
    o.data.color=(1,.69,.25);o.data.energy=energy;o.data.shadow_soft_size=1.3
    o.data.use_custom_distance=True;o.data.cutoff_distance=radius
# Broader, raised sources read as reflected rune light on the nearby floor.
for y,z in [(2.07,1.35),(10.84,.8)]:
    for x in [-1.1,1.1]:light(f'Soft rune spill {y} {x}',(x,y,z),24,5.5)
for index,name in enumerate(rear[::2][:4]):
    ids=groups[arch.vertex_groups[name].index];center=sum((positions[i] for i in ids),Vector())/len(ids)
    light(f'Soft rune spill rear pillar {index}',center+Vector((0,-.8,.35)),14,4.5)
for o in scene.objects:
    if o.type=='LIGHT' and o.name.startswith('Walkway rune'):
        o.location.z=1.0;o.location.x=math.copysign(1.41,o.location.x);o.data.energy=23;o.data.cutoff_distance=5.5

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set((o.type=='MESH' and not o.name.startswith(('Hero_','Atmosphere •'))) or o.type=='LIGHT' or o==scene.camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_extras=True,export_animations=False)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena.blend'))
print('Cleaned ink atlases:',list(images));print('Sharp emissive groups:',selected)
