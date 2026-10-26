"""Expose grass/rocks as movable nodes and add soft tower-crack spill lights."""
import bpy,bmesh,math,json,tempfile,re
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena.blend'));scene=bpy.context.scene
arch=bpy.data.objects['Arena_Columns_Props_Towers'];terrain=bpy.data.objects['Terrain_and_Floating_Rocks']

def group_ids(o):
    result={g.name:set() for g in o.vertex_groups};names={g.index:g.name for g in o.vertex_groups}
    for v in o.data.vertices:
        for g in v.groups:
            if g.weight>.5:result[names[g.group]].add(v.index);break
    return result
def extract(o,ids,name,base=False):
    mesh=o.data.copy();bm=bmesh.new();bm.from_mesh(mesh);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in ids],context='VERTS');bm.to_mesh(mesh);bm.free()
    points=[o.matrix_world@v.co for v in mesh.vertices]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
    pivot=(lo+hi)*.5
    if base:pivot.z=lo.z
    for v,p in zip(mesh.vertices,points):v.co=p-pivot
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.location=pivot
    used=sorted({p.material_index for p in mesh.polygons});materials=[mesh.materials[i] for i in used]
    remapped=[used.index(p.material_index) for p in mesh.polygons];mesh.materials.clear()
    for material in materials:mesh.materials.append(material)
    for p,i in zip(mesh.polygons,remapped):p.material_index=i
    return obj
def remove_ids(o,ids):
    if not ids:return
    bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[bm.verts[i] for i in ids],context='VERTS');bm.to_mesh(o.data);bm.free();o.data.update()

arch_groups=group_ids(arch)
# Put a real, soft light just outside each crack-bearing tower facade.
settings=json.loads((OUT/'arena-settings.json').read_text(encoding='utf-8-sig'))
for group_name in settings.get('faintCrackTowers',[]):
    ids=arch_groups.get(group_name,set())
    if not ids:continue
    name='Tower crack • soft warm spill '+group_name
    previous=bpy.data.objects.get(name)
    if previous:bpy.data.objects.remove(previous,do_unlink=True)
    positions=[arch.matrix_world@v.co for v in arch.data.vertices]
    points=[positions[i] for i in ids]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
    target=(lo+hi)*.5;target.z=lo.z+(hi.z-lo.z)*.6
    toward=Vector((scene.camera.location.x-target.x,scene.camera.location.y-target.y,0)).normalized()
    faces=[list(p.vertices) for p in arch.data.polygons if all(v in ids for v in p.vertices)]
    tree=BVHTree.FromPolygons(positions,faces)
    hit,normal,_,_=tree.ray_cast(target+toward*30,-toward,60)
    position=(hit+normal*.28) if hit else target+toward*.8
    bpy.ops.object.light_add(type='POINT',location=position);light=bpy.context.object;light.name=name
    light.data.color=(1,.40,.12);light.data.energy=2.2;light.data.shadow_soft_size=1.1

# The original blades are named pCubeNN with a shared suffix per clump.
blade_ids={28,31,41,42,43,45,46,47,48,49,50,51,52};clumps={}
for name,ids in arch_groups.items():
    match=re.fullmatch(r'pCube(\d+)(?:\.(\d+))?',name)
    if match and int(match[1]) in blade_ids and ids:
        clumps.setdefault(match[2] or '000',set()).update(ids)
removed=set()
for i,(suffix,ids) in enumerate(sorted(clumps.items())):
    grass=extract(arch,ids,'Arena_Grass_'+suffix,base=True)
    grass['arenaMotion']='grass';grass['motionSeed']=i*1.73
    # Lean the ring-side clumps away from the opening; bases remain planted.
    if abs(grass.location.x)<1.9 and .7<grass.location.y<2.5:
        side=-1 if grass.location.x<0 else 1
        grass.rotation_euler.y=math.radians(23)*side
        grass.rotation_euler.z=math.radians(-18)*side
    removed.update(ids)
remove_ids(arch,removed)

rocks=[];removed=set()
for i,(name,ids) in enumerate(group_ids(terrain).items()):
    if name.startswith('Floating_Rock_') and ids:
        rock=extract(terrain,ids,'Arena_'+name)
        rock['arenaMotion']='rock';rock['motionSeed']=i*1.37
        rocks.append(rock);removed.update(ids)
remove_ids(terrain,removed)

locations=[(-3.4,3.2,2.1),(3.4,4,2.7),(-2.7,6,3.4),(2.3,8,3),
           (-4.8,9,2.2),(4.7,10,4),(-.7,11,3.8),(1.4,12,4.2),
           (-3.8,1,1.4),(3.6,1,1.8),(-2,15,2.8),(3,16,3.6)]
if rocks:
    for i,location in enumerate(locations):
        name=f'Arena_Extra_Debris_{i+1:02d}';old=bpy.data.objects.get(name)
        if old:continue
        rock=rocks[i%len(rocks)].copy();rock.data=rocks[i%len(rocks)].data
        rock.name=name;bpy.context.collection.objects.link(rock);rock.location=location
        rock.scale=(.38+(i%4)*.09,)*3;rock.rotation_euler=(i*.27,i*.39,i*.73)
        rock['arenaMotion']='rock';rock['motionSeed']=20+i*1.41

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set((o.type=='MESH' and not o.name.startswith(('Hero_','Atmosphere •'))) or o.type=='LIGHT' or o==scene.camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_extras=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena.blend'))
settings.update({'towerCrackSpillLights':len(settings.get('faintCrackTowers',[])),
                 'animatedGrassClumps':len([o for o in scene.objects if o.get('arenaMotion')=='grass']),
                 'floatingRockCount':len([o for o in scene.objects if o.get('arenaMotion')=='rock']),
                 'motion':'slow bounded drift/tumble; anchored wind sway; respects reduced motion'})
(OUT/'arena-settings.json').write_text(json.dumps(settings,indent=2))
