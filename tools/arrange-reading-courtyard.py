"""Open the central reading area while keeping broken stone at its edges."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena.blend'));scene=bpy.context.scene
arch=bpy.data.objects['Arena_Columns_Props_Towers']
previous=json.loads(arch.get('readingCourtOffsets','{}'))
offsets={'BROKEN_PILLAR_1':[3,0,0],'pCylinder19':[-2,0,0],'sweep2.005':[3,0,0],
 'polySurface15':[-.8,0,0],'pCylinder4.015':[-.8,0,0],'pCube2.015':[-.8,0,0],
 'pCylinder4.016':[-.8,0,0],'pCube2.016':[-.8,0,0],
 'pCube4.001':[-2.5,0,0],'pCube5.001':[-2.5,0,0]}
for name,offset in offsets.items():
 group=arch.vertex_groups.get(name)
 if not group:raise RuntimeError('Missing courtyard group '+name)
 delta=arch.matrix_world.inverted().to_3x3()@(Vector(offset)-Vector(previous.get(name,[0,0,0])))
 for v in arch.data.vertices:
  if any(g.group==group.index and g.weight>.5 for g in v.groups):v.co+=delta
arch['readingCourtOffsets']=json.dumps(offsets);arch.data.update()
grass=bpy.data.objects.get('Arena_Grass_005')
if grass:
 grass.location.x+=3-float(grass.get('readingCourtOffsetX',0));grass['readingCourtOffsetX']=3

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set((o.type=='MESH' and not o.name.startswith(('Hero_','Atmosphere •'))) or o.type=='LIGHT' or o==scene.camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_extras=True,export_animations=False)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena.blend'))
print('Reading court offsets:',offsets)
