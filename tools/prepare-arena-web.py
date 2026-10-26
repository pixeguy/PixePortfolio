"""Make the canonical small-character scene and environment-only web export."""
import bpy, math, json, tempfile
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
source=OUT/'arena-vibrant-palette.blend'
if not source.exists():source=OUT/'arena.blend'
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;camera=scene.camera
factor=1.8/3.3 if source.name!='arena.blend' else 1
foot=Vector((0,-.170972,.058))
transform=Matrix.Translation(foot)@Matrix.Scale(factor,4)@Matrix.Translation(-foot)
hero=[o for o in scene.objects if o.type=='MESH' and o.name.startswith('Hero_')]
for o in hero:
    o.matrix_world=transform@o.matrix_world
    o.hide_render='Gold_Edges' not in o.name
for o in scene.objects:
    if o.type=='LIGHT' and o.name.startswith('Character'):
        o.location=transform@o.location;o.data.energy*=factor;o.data.shadow_soft_size*=factor
camera.location=(-.35,-3.65,.22);camera.rotation_mode='QUATERNION'
camera.rotation_quaternion=(Vector((-.65,-.17,1.0))-camera.location).to_track_quat('-Z','Y')
points=[o.matrix_world@v.co for o in hero if 'Gold_Edges' not in o.name for v in o.data.vertices]
for _ in range(12):
    bpy.context.view_layer.update();p=[world_to_camera_view(scene,camera,v) for v in points]
    xmin,xmax=min(v.x for v in p),max(v.x for v in p);ymin,ymax=min(v.y for v in p),max(v.y for v in p)
    camera.data.lens*=.65/(ymax-ymin)
    yaw=math.atan((.69-(xmin+xmax)/2)*2*math.tan(camera.data.angle_x/2))*.8
    pitch=-math.atan((.5-(ymin+ymax)/2)*2*math.tan(camera.data.angle_y/2))*.8
    camera.rotation_quaternion=camera.rotation_quaternion@Quaternion((0,1,0),yaw)@Quaternion((1,0,0),pitch)
for o in scene.objects:
    if o.type!='MESH':continue
    used=sorted({p.material_index for p in o.data.polygons});mats=[o.data.materials[i] for i in used]
    indices=[used.index(p.material_index) for p in o.data.polygons]
    o.data.materials.clear()
    for mat in mats:o.data.materials.append(mat)
    for p,i in zip(o.data.polygons,indices):p.material_index=i
scene.cycles.samples=64;scene.render.filepath=str(OUT/'arena-preview.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set((o.type=='MESH' and not o.name.startswith(('Hero_','Atmosphere •'))) or o.type=='LIGHT' or o==camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_extras=True,export_animations=False)
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena.blend'))
settings_path=OUT/'arena-settings.json'
settings=json.loads(settings_path.read_text()) if settings_path.exists() else {}
settings.update({'characterHeight':1.8,'previousCharacterHeight':3.3,'floorY':.058,'characterZ':.170972,'fogDensity':settings.get('fogDensity',.003),'runtimeModel':'arena.glb','runtimeCharacter':'../portfolio-character.fbx','runtimeCharacterAppearance':'outline only','sky':'transparent; existing star and purple cloud canvases','export':'environment and lights only; no duplicated static character'})
settings_path.write_text(json.dumps(settings,indent=2))
