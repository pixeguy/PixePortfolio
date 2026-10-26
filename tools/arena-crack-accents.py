"""One foreground pillar accent and faint cracks on the original rear towers."""
import bpy, math, random, tempfile, json
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena.blend'));scene=bpy.context.scene
arch=bpy.data.objects['Arena_Columns_Props_Towers']
for name in ['Distant_Opening_Tower_Left','Distant_Opening_Tower_Right']:
    for target in [name,name+' moonlight']:
        o=bpy.data.objects.get(target)
        if o:bpy.data.objects.remove(o,do_unlink=True)

material=next(m for m in arch.data.materials if m.name.startswith('Painted ink stone'))
node=next(n for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and '_Emission' in n.image.name)
image=node.image;w,h=image.size
pixels=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
uv=arch.data.uv_layers['PaintedInkUV'];groups={g.index:set() for g in arch.vertex_groups}
for v in arch.data.vertices:
    for g in v.groups:
        if g.weight>.5:groups[g.group].add(v.index);break
def tile_for(name):
    g=arch.vertex_groups.get(name)
    if not g:return None
    ids=groups[g.index]
    for face in arch.data.polygons:
        if all(v in ids for v in face.vertices) and arch.data.materials[face.material_index]==material:
            p=uv.data[face.loop_start].uv;x=int(p.x*w)//256*256;y=int(p.y*h)//256*256
            return pixels[y:y+256,x:x+256]
    return None
def paint(tile,path,width,color):
    for i,(a,b) in enumerate(zip(path,path[1:])):
        a=np.array(a)*255;b=np.array(b)*255;r=width*(.8+.2*math.sin(i*1.7+.8))
        lo=np.maximum(0,np.floor(np.minimum(a,b)-r-1).astype(int));hi=np.minimum(256,np.ceil(np.maximum(a,b)+r+1).astype(int))
        if np.any(hi<=lo):continue
        yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]];ab=b-a
        t=np.clip(((xx-a[0])*ab[0]+(yy-a[1])*ab[1])/max(float(ab@ab),1e-8),0,1)
        d=np.sqrt((xx-a[0]-t*ab[0])**2+(yy-a[1]-t*ab[1])**2)
        coverage=np.clip(r+.7-d,0,1)[:,:,None]
        region=tile[lo[1]:hi[1],lo[0]:hi[0],:3]
        region[:]=np.maximum(region,np.array(color)*coverage)

# The wide reference includes .002 at the left margin, then .003. A narrower
# viewport crops that first column, so use the reference's physical column.
for old_name in ['pCylinder4.002','pCube2.002']:
    old_tile=tile_for(old_name)
    if old_tile is not None:old_tile[:,:,:3]=0
for name in ['pCylinder4.003','pCube2.003']:
    tile=tile_for(name)
    if tile is None:raise RuntimeError('Missing painted pillar tile: '+name)
    tile[:,:,:3]=0
    path=[(.22,.97),(.34,.81),(.65,.72),(.49,.57),(.69,.46),(.42,.32),(.32,.11)]
    if name.startswith('pCube'):path=[(.12,.83),(.37,.66),(.6,.71),(.81,.44),(.94,.47)]
    paint(tile,path,1.25,(1,.43,.07))
    paint(tile,[path[2],(.84,.79),(.95,.71)],.85,(1,.43,.07))
    paint(tile,[path[-3],(.22,.43),(.1,.37)],.65,(1,.43,.07))

painted_towers=[]
for g in arch.vertex_groups:
    if not g.name.startswith('Atmosphere_Tower_'):continue
    tile=tile_for(g.name)
    if tile is None:continue
    rng=random.Random(882+g.index)
    path=[(.2+rng.uniform(-.08,.12),.88),(.42,.76),(.34,.63),(.65,.53),(.51,.36),(.61,.2)]
    if g.index%2:path=[(1-u,v) for u,v in path]
    # glTF samples emission PNGs as sRGB. These encoded values give roughly
    # 3.5% of the foreground's linear red-channel emission in the browser.
    paint(tile,path,2.0,(.20,.095,.016))
    paint(tile,[path[2],(.76,.7),(.88,.65)],1.2,(.16,.075,.012))
    painted_towers.append(g.name)

replacement=bpy.data.images.new('Painted_Architecture_Emission_Accents',width=w,height=h,alpha=False)
replacement.colorspace_settings.name='Non-Color';replacement.pixels.foreach_set(pixels.ravel());replacement.update()
replacement.filepath_raw=str(OUT/'Painted_Arena_Columns_Props_Towers_Emission.png');replacement.file_format='PNG';replacement.save();replacement.pack();node.image=replacement
for suffix,group_name in [('shaft','pCylinder4.003'),('capital','pCube2.003')]:
    name='Second left pillar • '+suffix+' warm spill';old=bpy.data.objects.get(name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    ids=groups[arch.vertex_groups[group_name].index]
    center=sum((arch.matrix_world@arch.data.vertices[i].co for i in ids),Vector())/len(ids)
    center.y-=.22
    bpy.ops.object.light_add(type='POINT',location=center);o=bpy.context.object;o.name=name
    o.data.color=(1,.40,.1);o.data.energy=8 if suffix=='shaft' else 3;o.data.shadow_soft_size=.32

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set((o.type=='MESH' and not o.name.startswith(('Hero_','Atmosphere •'))) or o.type=='LIGHT' or o==scene.camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena.blend'))
settings=json.loads((OUT/'arena-settings.json').read_text(encoding='utf-8-sig'))
settings.update({'addedDistantTowers':0,'foregroundCrackPillar':'pCylinder4.003','faintCrackTowers':painted_towers,'towerCrackEmissionRelative':.035})
(OUT/'arena-settings.json').write_text(json.dumps(settings,indent=2))
