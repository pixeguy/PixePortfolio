"""Stage the existing character in the arena for a low, right-framed hero shot."""
import bpy, bmesh, math, json, tempfile
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'poseidon-space-arena.blend'))
scene=bpy.context.scene
before=set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(ROOT/'assets/portfolio-character.fbx'))
imported=set(bpy.data.objects)-before
rig=next(o for o in imported if o.type=='ARMATURE')
action=next(a for a in bpy.data.actions if a.name.split('|')[-1]=='Standing')
rig.animation_data.action=action
if action.slots:rig.animation_data.action_slot=action.slots[0]
scene.frame_set(200);bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
posed=[]
for o in imported:
    if o.type!='MESH':continue
    evaluated=o.evaluated_get(deps)
    mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=deps)
    mesh.transform(o.matrix_world)
    posed.append((o.name,mesh))
points=[v.co.copy() for _,mesh in posed for v in mesh.vertices]
lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
scale=3.3/(hi.z-lo.z)
center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
position=Vector((0,-.170972,.058))
turn=Matrix.Rotation(math.radians(-10),3,'Z')
for o in list(imported):bpy.data.objects.remove(o,do_unlink=True)
armor=bpy.data.materials.new('Hero • charcoal armor');armor.use_nodes=True
bs=armor.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.016,.013,.025,1);bs.inputs['Metallic'].default_value=.18;bs.inputs['Roughness'].default_value=.6
gold=bpy.data.materials.new('Hero • gold contour');gold.use_nodes=True
bs=gold.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.8,.48,.06,1);bs.inputs['Metallic'].default_value=.35;bs.inputs['Roughness'].default_value=.45;bs.inputs['Emission Color'].default_value=(.9,.5,.045,1);bs.inputs['Emission Strength'].default_value=1.4
hero=[]
for name,mesh in posed:
    for v in mesh.vertices:v.co=turn@((v.co-center)*scale)+position
    mesh.materials.clear();mesh.materials.append(armor)
    o=bpy.data.objects.new('Hero_'+name,mesh);bpy.context.collection.objects.link(o);hero.append(o)
scene.frame_set(1)
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(-.45,-5.3,.36));camera=bpy.context.object;camera.name='Hero_Low_Angle_Right'
camera.data.lens=30;camera.data.clip_start=.05;camera.data.clip_end=250
target=Vector((-.9,-.17,1.48));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
all_points=[o.matrix_world@v.co for o in hero for v in o.data.vertices]
def bounds():
    q=[world_to_camera_view(scene,camera,p) for p in all_points]
    return min(p.x for p in q),max(p.x for p in q),min(p.y for p in q),max(p.y for p in q)
camera.rotation_mode='QUATERNION';camera.rotation_quaternion=(target-camera.location).to_track_quat('-Z','Y')
# Use camera orientation rather than lens shift: glTF perspective cameras do
# not carry Blender's lens-shift values, so this framing survives export.
for _ in range(12):
    bpy.context.view_layer.update();xmin,xmax,ymin,ymax=bounds()
    camera.data.lens*=.80/(ymax-ymin)
    bpy.context.view_layer.update();xmin,xmax,ymin,ymax=bounds()
    dx=.72-(xmin+xmax)/2;dy=.5-(ymin+ymax)/2
    yaw=math.atan(dx*2*math.tan(camera.data.angle_x/2))*.8
    pitch=-math.atan(dy*2*math.tan(camera.data.angle_y/2))*.8
    camera.rotation_quaternion=camera.rotation_quaternion@Quaternion((0,1,0),yaw)@Quaternion((1,0,0),pitch)

# Gold contours are actual thin mesh strokes, so they survive GLB export.
# Static silhouette extraction uses this composed camera and the posed mesh.
outline_count=0
for o in hero:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00005);bm.normal_update()
    curve=bpy.data.curves.new(o.name+'_Contours','CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=.0032;curve.bevel_resolution=0
    for edge in bm.edges:
        middle=(edge.verts[0].co+edge.verts[1].co)*.5;view=(camera.location-middle).normalized()
        faces=list(edge.link_faces)
        silhouette=len(faces)==1 or (len(faces)==2 and faces[0].normal.dot(view)*faces[1].normal.dot(view)<0)
        crease=len(faces)==2 and faces[0].normal.dot(faces[1].normal)<.72
        if not (silhouette or crease):continue
        spline=curve.splines.new('POLY');spline.points.add(1)
        for i,v in enumerate(edge.verts):spline.points[i].co=(*v.co,1)
        outline_count+=1
    bm.free()
    lines=bpy.data.objects.new(o.name+'_Gold_Edges',curve);bpy.context.collection.objects.link(lines);curve.materials.append(gold)
    bpy.ops.object.select_all(action='DESELECT');lines.select_set(True);bpy.context.view_layer.objects.active=lines;bpy.ops.object.convert(target='MESH')

# A subtle world treatment reads as open sky in the preview, with no sky mesh.
world=bpy.data.worlds.new('Open purple space sky');world.use_nodes=True;scene.world=world
nt=world.node_tree;nt.nodes.clear()
coord=nt.nodes.new('ShaderNodeTexCoord');noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.2;noise.inputs['Detail'].default_value=4;noise.inputs['Roughness'].default_value=.7;nt.links.new(coord.outputs['Normal'],noise.inputs['Vector'])
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.3;ramp.color_ramp.elements[0].color=(.004,.002,.011,1);ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=(.09,.035,.16,1);nt.links.new(noise.outputs['Fac'],ramp.inputs[0])
background=nt.nodes.new('ShaderNodeBackground');background.inputs['Strength'].default_value=.35;nt.links.new(ramp.outputs[0],background.inputs[0]);out=nt.nodes.new('ShaderNodeOutputWorld');nt.links.new(background.outputs[0],out.inputs[0])
def area(name,loc,color,energy,size):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.color=color;o.data.energy=energy;o.data.size=size;o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
area('Hero rim',(1,2,4.5),(.6,.35,1),240,2)
area('Hero soft key',(-2,-3,3.5),(.8,.72,1),120,3)
scene.render.film_transparent=False;scene.render.engine='CYCLES';scene.cycles.samples=48
scene.render.filepath=str(OUT/'arena-character.png');bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(o.type=='MESH' or o==camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena-character.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_animations=False)
bpy.ops.export_scene.fbx(filepath=str(OUT/'arena-character.fbx'),use_selection=True,object_types={'MESH','CAMERA'},add_leaf_bones=False,path_mode='COPY',embed_textures=True,bake_anim=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena-character.blend'))
xmin,xmax,ymin,ymax=bounds()
(OUT/'character-composition.json').write_text(json.dumps({'character_source':'portfolio-character.fbx','pose':'Standing, frame 200, static snapshot','character_height':3.3,'character_position':list(position),'camera_location':list(camera.location),'camera_lens':camera.data.lens,'screen_bounds':[xmin,xmax,ymin,ymax],'screen_center_x':(xmin+xmax)/2,'gold_edge_segments':outline_count,'sky':'preview world shader, no sky mesh'},indent=2))
