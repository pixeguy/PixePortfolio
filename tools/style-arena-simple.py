"""Material and lighting variant: toon bands, purple gradients and amber accents.

Loads the authored character scene and preserves all mesh positions/topology
and camera transforms. Only shading, color attributes, materials and lights
are changed. Outputs a sibling variant for comparison.
"""
import bpy, math, hashlib, json, tempfile
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena-character.blend'))
scene=bpy.context.scene;camera=scene.camera
meshes=[o for o in scene.objects if o.type=='MESH']
def signature():
    result={}
    for o in meshes:
        points=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',points)
        loops=np.empty(len(o.data.loops),dtype=np.int32);o.data.loops.foreach_get('vertex_index',loops)
        result[o.name]=hashlib.sha256(points.tobytes()+loops.tobytes()+np.array(o.matrix_world,dtype=np.float64).tobytes()).hexdigest()
    return result
before=signature();camera_before=(tuple(camera.matrix_world),camera.data.lens,camera.data.shift_x,camera.data.shift_y)

def material(name):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.94;bs.inputs['Specular IOR Level'].default_value=.12;bs.inputs['Emission Strength'].default_value=0
    return m,bs
stone,stone_bs=material('Stylized • purple gradient stone')
color=stone.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='StylizedColor';stone.node_tree.links.new(color.outputs['Color'],stone_bs.inputs['Base Color'])
warm,warm_bs=material('Stylized • sparse amber facets');warm_bs.inputs['Base Color'].default_value=(.65,.25,.025,1);warm_bs.inputs['Emission Color'].default_value=(1,.4,.04,1);warm_bs.inputs['Emission Strength'].default_value=.8
gold,gold_bs=material('Stylized • character gold outline');gold_bs.inputs['Base Color'].default_value=(.9,.51,.06,1);gold_bs.inputs['Emission Color'].default_value=(1,.5,.055,1);gold_bs.inputs['Emission Strength'].default_value=1.8

key_direction=Vector((-.5,-.6,.8)).normalized()
gold_faces=0
for o in meshes:
    if 'Gold_Edges' in o.name:
        o.data.materials.clear();o.data.materials.append(gold);continue
    mesh=o.data
    attr=mesh.color_attributes.get('StylizedColor') or mesh.color_attributes.new(name='StylizedColor',type='FLOAT_COLOR',domain='CORNER')
    mesh.color_attributes.active_color=attr
    groups={g.index:g.name for g in o.vertex_groups}
    group_extents={}
    for v in mesh.vertices:
        group=v.groups[0].group if v.groups else -1
        if group not in group_extents:group_extents[group]=[v.co.z,v.co.z]
        group_extents[group][0]=min(group_extents[group][0],v.co.z);group_extents[group][1]=max(group_extents[group][1],v.co.z)
    colors=np.ones((len(mesh.loops),4),dtype=np.float32)
    hero=o.name.startswith('Hero_')
    matrix=o.matrix_world.to_3x3().inverted().transposed()
    mesh.materials.clear();mesh.materials.append(stone);mesh.materials.append(warm)
    for face in mesh.polygons:
        normal=(matrix@face.normal).normalized();light=normal.dot(key_direction)
        band=.65 if light<.12 else .92 if light<.62 else 1.18
        if hero:band=.8 if light<.3 else 1.1
        group=mesh.vertices[mesh.loops[face.loop_start].vertex_index].groups
        group=group[0].group if group else -1
        group_name=groups.get(group,o.name)
        seed=int(hashlib.sha256(group_name.encode()).hexdigest()[:6],16)/0xffffff
        face.material_index=0
        # A few existing rock facets receive a warm accent. No geometry added.
        if group_name in ['Floating_Rock_04','Floating_Rock_09','Floating_Rock_14'] and normal.z>.65:
            face.material_index=1;gold_faces+=1
        if not hero:face.use_smooth=False
        lo,hi=group_extents[group]
        for loop in face.loop_indices:
            p=mesh.vertices[mesh.loops[loop].vertex_index].co
            t=(p.z-lo)/max(hi-lo,.3)
            t=max(0,min(1,t))
            if o.name=='polySurface11':t=.4+.15*math.sin(p.x*.45+p.y*.18)
            if hero:
                low=np.array((.012,.006,.035));high=np.array((.045,.021,.085))
            else:
                low=np.array((.025,.012,.075));high=np.array((.15,.075,.27))
            rgb=(low*(1-t)+high*t)*band*(.87+seed*.22)
            colors[loop,:3]=rgb
    attr.data.foreach_set('color',colors.ravel());mesh.update()

# Existing rune locations/UVs are preserved; their purple emission masks are
# rebaked as amber images. Base surfaces use only the simple vertex gradients.
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.render.bake.margin=8
for name,prefix in [('polySurface11','Floor'),('polySurface14','Ring'),('pTorus3','SecondRing')]:
    o=bpy.data.objects[name]
    # Read the original emission mask directly from the source scene's image.
    src=bpy.data.images.get(prefix+'_Emissive')
    if src is None:raise RuntimeError('Missing original rune mask: '+prefix)
    m,bs=material('Stylized • '+prefix+' gradient and gold runes');nt=m.node_tree
    v=nt.nodes.new('ShaderNodeVertexColor');v.layer_name='StylizedColor';nt.links.new(v.outputs['Color'],bs.inputs['Base Color'])
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=src
    bw=nt.nodes.new('ShaderNodeRGBToBW');nt.links.new(tex.outputs['Color'],bw.inputs[0])
    gain=nt.nodes.new('ShaderNodeMath');gain.operation='MULTIPLY';gain.use_clamp=True;gain.inputs[1].default_value=4;nt.links.new(bw.outputs[0],gain.inputs[0])
    tint=nt.nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;nt.links.new(gain.outputs[0],tint.inputs[1]);tint.inputs[2].default_value=(1,.5,.055,1)
    emit=nt.nodes.new('ShaderNodeEmission');nt.links.new(tint.outputs[0],emit.inputs[0]);output=nt.nodes.get('Material Output');nt.links.new(emit.outputs[0],output.inputs[0])
    img=bpy.data.images.new('Stylized_'+prefix+'_Gold',width=src.size[0],height=src.size[1],alpha=False)
    target=nt.nodes.new('ShaderNodeTexImage');target.image=img;nt.nodes.active=target
    o.data.materials.clear();o.data.materials.append(m)
    for face in o.data.polygons:face.material_index=0
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.bake(type='EMIT')
    img.filepath_raw=str(OUT/f'Stylized_{prefix}_Gold.png');img.file_format='PNG';img.save();img.pack()
    nt.links.new(bs.outputs[0],output.inputs[0]);nt.links.new(target.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=3
    for node in [tex,bw,gain,tint,emit]:nt.nodes.remove(node)

# Violet/indigo fill and restrained amber light, based on the reference palette.
for o in scene.objects:
    if o.type!='LIGHT':continue
    o.data.energy*=.45
    o.data.color=(.34,.12,1) if o.location.x>0 else (.28,.26,1)
def area(name,loc,color,energy,size,target):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.color=color;o.data.energy=energy;o.data.size=size;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Stylized amber key',(-3,-3,4.5),(1,.42,.12),450,3,(0,0,.8))
area('Stylized violet rim',(3,4,5),(.3,.035,1),650,3,(0,0,1.2))
area('Stylized gold rune bounce',(0,.1,.5),(1,.44,.10),30,2,(0,0,2))
world=bpy.data.worlds.new('Stylized • deep indigo sky');world.use_nodes=True;scene.world=world
world.node_tree.nodes['Background'].inputs[0].default_value=(.006,.002,.028,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.render.film_transparent=False;scene.cycles.samples=64
scene.view_settings.view_transform='AgX'

# Soft glare is a render effect; the emissive masks are also in the GLB.
tree=bpy.data.node_groups.new('Stylized soft gold bloom','CompositorNodeTree')
tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
layers=tree.nodes.new('CompositorNodeRLayers');glare=tree.nodes.new('CompositorNodeGlare')
glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='High'
glare.inputs['Threshold'].default_value=1;glare.inputs['Strength'].default_value=.6;glare.inputs['Size'].default_value=.15
output=tree.nodes.new('NodeGroupOutput');tree.links.new(layers.outputs['Image'],glare.inputs['Image']);tree.links.new(glare.outputs['Image'],output.inputs['Image']);scene.compositing_node_group=tree
scene.render.filepath=str(OUT/'arena-stylized.png');bpy.ops.render.render(write_still=True)
assert before==signature(),'Geometry or placements changed'
assert camera_before==(tuple(camera.matrix_world),camera.data.lens,camera.data.shift_x,camera.data.shift_y),'Camera changed'
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(o.type=='MESH' or o==camera)
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena-stylized.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_animations=False)
bpy.ops.export_scene.fbx(filepath=str(OUT/'arena-stylized.fbx'),use_selection=True,object_types={'MESH','CAMERA'},add_leaf_bones=False,path_mode='COPY',embed_textures=True,bake_anim=False)
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena-stylized.blend'))
(OUT/'stylized-report.json').write_text(json.dumps({'geometry_and_placements_unchanged':before==signature(),'camera_unchanged':True,'mesh_count':len(meshes),'accent_faces':gold_faces,'style':'toon bands + purple gradients + amber emission','geometry_hashes':before},indent=2))
