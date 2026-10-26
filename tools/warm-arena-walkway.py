"""Inward painted rail runes, rear carved stones, and localized golden spill.

Edits only upper railing emission, adds rear details, and preserves the camera,
character, existing architecture and motion extras. Safe to rerun.
"""
import bpy, math, tempfile, random
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent; OUT=ROOT/'assets/poseidon-space-arena'
tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena.blend'));scene=bpy.context.scene
for o in list(scene.objects):
    if o.name.startswith(('Walkway rune','Rear rune stone','Rear magic','Rear courtyard debris','Front ring gold','Second ring gold')):
        bpy.data.objects.remove(o,do_unlink=True)
arch=bpy.data.objects['Arena_Columns_Props_Towers'];mesh=arch.data
groups={g.index:set() for g in arch.vertex_groups}
for v in mesh.vertices:
    for g in v.groups:
        if g.weight>.5:groups[g.group].add(v.index);break
positions=[arch.matrix_world@v.co for v in mesh.vertices]
base_material=next(m for m in mesh.materials if m.name.startswith('Painted ink stone'))
emission_node=next(n for n in base_material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and '_Emission' in n.image.name)
image=emission_node.image;w,h=image.size
pixels=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
uv=mesh.uv_layers['PaintedInkUV']
rail_names=['pCube18','pCube18.001']
# Clear both old glowing fissures from their dedicated atlas tiles.
for name in rail_names:
    ids=groups[arch.vertex_groups[name].index]
    for face in mesh.polygons:
        if all(v in ids for v in face.vertices):
            p=uv.data[face.loop_start].uv;x=int(p.x*w)//256*256;y=int(p.y*h)//256*256
            pixels[y:y+256,x:x+256,:3]=0;break
image.pixels.foreach_set(pixels.ravel());image.update()
image.filepath_raw=str(OUT/'Painted_Arena_Columns_Props_Towers_Emission.png');image.file_format='PNG';image.save();image.pack()

def stroke(tile,path,width,color):
    hh,ww=tile.shape[:2]
    for a,b in zip(path,path[1:]):
        a=np.array(a)*[ww-1,hh-1];b=np.array(b)*[ww-1,hh-1]
        lo=np.maximum(0,np.floor(np.minimum(a,b)-width-1).astype(int));hi=np.minimum([ww,hh],np.ceil(np.maximum(a,b)+width+1).astype(int))
        if np.any(hi<=lo):continue
        yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]];ab=b-a
        t=np.clip(((xx-a[0])*ab[0]+(yy-a[1])*ab[1])/max(float(ab@ab),1e-8),0,1)
        d=np.sqrt((xx-a[0]-t*ab[0])**2+(yy-a[1]-t*ab[1])**2)
        tile[lo[1]:hi[1],lo[0]:hi[0],:3]=np.maximum(tile[lo[1]:hi[1],lo[0]:hi[0],:3],np.array(color)*np.clip(width+.65-d,0,1)[:,:,None])

glyphs=[
 [[(.25,.16),(.25,.84),(.73,.57),(.25,.44)]],
 [[(.22,.22),(.5,.82),(.78,.22)],[(.34,.47),(.67,.47)]],
 [[(.25,.8),(.73,.8),(.4,.47),(.73,.17)],[(.4,.47),(.25,.17)]],
 [[(.5,.13),(.5,.87)],[(.25,.63),(.5,.42),(.76,.63)]],
 [[(.2,.25),(.5,.8),(.8,.25),(.2,.25)],[(.5,.25),(.5,.1)]],
 [[(.24,.18),(.24,.82),(.75,.59),(.24,.4)],[(.24,.4),(.71,.18)]],
]
def save_image(name,px):
    hh,ww=px.shape[:2];img=bpy.data.images.new(name,width=ww,height=hh,alpha=False)
    img.colorspace_settings.name='Non-Color';img.pixels.foreach_set(px.ravel());img.update()
    img.filepath_raw=str(OUT/(name+'.png'));img.file_format='PNG';img.save();img.pack();return img

# Long horizontal frieze: symbols occupy only the upper half of each inner face.
rail=np.ones((256,3072,4),dtype=np.float32);rail[:,:,:3]=0
for i in range(12):
    tile=rail[128:244,i*256+65:i*256+191]
    for path in glyphs[i%len(glyphs)]:stroke(tile,path,2.6,(1,.64,.17))
rail_image=save_image('Walkway_Inner_Rail_Runes',rail)
rail_uv=mesh.uv_layers.get('InnerRailRuneUV') or mesh.uv_layers.new(name='InnerRailRuneUV')
for name in rail_names:
    ids=groups[arch.vertex_groups[name].index];ps=[positions[i] for i in ids]
    low=Vector(tuple(min(p[a] for p in ps) for a in range(3)));high=Vector(tuple(max(p[a] for p in ps) for a in range(3)))
    inward=1 if low.x<0 else -1
    mat=base_material.copy();mat.name='Walkway rune • inward gold '+name
    nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF');old=bs.inputs['Emission Color']
    for link in list(old.links):nt.links.remove(link)
    un=nt.nodes.new('ShaderNodeUVMap');un.uv_map=rail_uv.name
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=rail_image;tex.extension='EXTEND'
    nt.links.new(un.outputs['UV'],tex.inputs['Vector']);nt.links.new(tex.outputs['Color'],old);bs.inputs['Emission Strength'].default_value=6
    slot=len(mesh.materials);mesh.materials.append(mat)
    for face in mesh.polygons:
        normal=(arch.matrix_world.to_3x3()@face.normal).normalized()
        if all(v in ids for v in face.vertices) and normal.x*inward>.95:
            face.material_index=slot
            for li in face.loop_indices:
                p=positions[mesh.loops[li].vertex_index]
                rail_uv.data[li].uv=((p.y-low.y)/(high.y-low.y),(p.z-low.z)/(high.z-low.z))

def light(name,loc,power,radius=3.5):
    bpy.ops.object.light_add(type='POINT',location=loc);o=bpy.context.object;o.name=name
    o.data.color=(1,.64,.21);o.data.energy=power;o.data.shadow_soft_size=.65
    o.data.use_custom_distance=True;o.data.cutoff_distance=radius
    return o

for side in [-1,1]:
    for index,y in enumerate([4.2,7.1,10.1]):
        light(f'Walkway rune • {side} warm spill {index}',(side*2.32,y,.48),36,4.8)
    light(f'Front ring gold • side spill {side}',(side*.98,1.76,1.0),34,3.8)
    light(f'Second ring gold • side spill {side}',(side*.63,10.57,.36),30,3.8)
light('Front ring gold • platform pool',(0,.5,.32),22,3.4)
light('Second ring gold • rear pool',(0,12,.0),28,4.2)

# Five low-poly rune stones carry the visual language into the rear courtyard.
# Glyphs and hand-cut ink chips are painted in a small texture, never line meshes.
stone_em=np.ones((512,3072,4),dtype=np.float32);stone_em[:,:,:3]=0
for index,glyph in enumerate(glyphs):
    for path in glyph:stroke(stone_em[:,index*512:(index+1)*512],path,4.5,(1,.64,.17))
stone_base=np.ones((512,512,4),dtype=np.float32)
t=np.linspace(0,1,512)[:,None,None];stone_base[:,:,:3]=np.array((.07,.045,.14))*(1-t)+np.array((.25,.16,.36))*t
for path in [[(.03,.76),(.14,.69),(.12,.54)],[(.96,.28),(.8,.37),(.84,.5)],[(.61,.98),(.58,.88),(.65,.82)]]:
    stroke(stone_base,path,1.3,(.006,.003,.011))
# Dark ink strokes replace the pigment rather than taking a maximum.
for a,b in [((.03,.76),(.14,.69)),((.14,.69),(.12,.54)),((.96,.28),(.8,.37)),((.8,.37),(.84,.5))]:
    mask=np.ones_like(stone_base);mask[:,:,:3]=0;stroke(mask,[a,b],1.6,(1,1,1));coverage=mask[:,:,:1]
    stone_base[:,:,:3]=stone_base[:,:,:3]*(1-coverage)+np.array((.009,.005,.018))*coverage
stone_ink=save_image('Rear_Runestone_Ink',np.tile(stone_base,(1,6,1)));stone_glow=save_image('Rear_Runestone_Gold',stone_em)
mat=bpy.data.materials.new('Rear rune stone • painted violet and gold');mat.use_nodes=True;nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value=.96;bs.inputs['Emission Strength'].default_value=6
for img,socket in [(stone_ink,'Base Color'),(stone_glow,'Emission Color')]:
    node=nt.nodes.new('ShaderNodeTexImage');node.image=img;nt.links.new(node.outputs['Color'],bs.inputs[socket])
plain=base_material.copy();plain.name='Rear rune stone • unlit sides'
pbs=plain.node_tree.nodes.get('Principled BSDF')
for socket in ['Base Color','Emission Color']:
    for link in list(pbs.inputs[socket].links):plain.node_tree.links.remove(link)
pbs.inputs['Base Color'].default_value=(.085,.055,.18,1);pbs.inputs['Emission Color'].default_value=(0,0,0,1)
for i,(x,y,height) in enumerate([(-2.1,12.8,.65),(2.2,12.3,.78),(-2.8,15.4,.86),(2.5,15.8,.6),(.65,17.3,.78)]):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,-.53+height/2));o=bpy.context.object;o.name=f'Rear rune stone {i+1:02}'
    o.dimensions=(.42,.27,height);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(plain);o.data.materials.append(mat)
    # Put the glowing painted face toward the approaching camera.
    for face in o.data.polygons:
        if face.normal.y<-.9:
            face.material_index=1
            for li in face.loop_indices:
                p=o.data.vertices[o.data.loops[li].vertex_index].co
                o.data.uv_layers.active.data[li].uv=((p.x/.42+.5+i)/6,p.z/height+.5)
    bevel=o.modifiers.new('Chipped low-poly corners','BEVEL');bevel.width=.045;bevel.segments=1
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
    o.rotation_euler[2]=.1 if x<0 else -.12
    light(f'Rear magic • stone {i+1} warm pool',(x,y-.35,-.08),26,3.8)

# Add a few carved accents to the existing rear columns, not just new props.
rear_columns=[]
for g in arch.vertex_groups:
    ids=groups[g.index]
    if not g.name.startswith('pCylinder') or not ids:continue
    center=sum((positions[i] for i in ids),Vector())/len(ids)
    if 11.5<center.y<17 and 1<abs(center.x)<3:rear_columns.append((g,ids,center))
for index,(g,ids,center) in enumerate(rear_columns[::3][:3]):
    for face in mesh.polygons:
        if all(v in ids for v in face.vertices):
            p=uv.data[face.loop_start].uv;tx=int(p.x*w)//256*256;ty=int(p.y*h)//256*256
            tile=pixels[ty+70:ty+206,tx+60:tx+196]
            for path in glyphs[(index+2)%len(glyphs)]:stroke(tile,path,1.7,(.72,.42,.09))
            break
    light(f'Rear magic • existing column {index+1}',center+Vector((0,-.32,.12)),22,3.2)
image.pixels.foreach_set(pixels.ravel());image.update();image.save();image.pack()
for i,loc in enumerate([(-2,13.4,2.2),(2.7,15,2.6),(-.7,17.1,2.8)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.20+i*.045,location=loc)
    o=bpy.context.object;o.name=f'Rear courtyard debris {i+1:02}';o.scale=(1,.72,1.1)
    o.data.materials.append(plain);o['arenaMotion']='rock';o['motionSeed']=43+i*2.7

# Export only the website environment, retaining per-object motion metadata.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set((o.type=='MESH' and not o.name.startswith(('Hero_','Atmosphere •'))) or o.type=='LIGHT' or o==scene.camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_extras=True,export_animations=False)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena.blend'))
print('Saved inward rail runes, rear stones/column carvings/debris, and warm spill lights.')
