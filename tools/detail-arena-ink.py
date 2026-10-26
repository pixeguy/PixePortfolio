"""Add selective warm emissive fissures and comic ink to the stylized scene."""
import bpy,bmesh,math,json,hashlib,tempfile
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True);tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena-stylized.blend'))
scene=bpy.context.scene;camera=scene.camera;base=[o for o in scene.objects if o.type=='MESH']
def geometry_hash(o):
    co=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',co)
    return hashlib.sha256(co.tobytes()+np.array(o.matrix_world,dtype=np.float64).tobytes()).hexdigest()
before={o.name:geometry_hash(o) for o in base};camera_matrix=camera.matrix_world.copy()
def mat(name,color,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=1;bs.inputs['Metallic'].default_value=0;bs.inputs['Specular IOR Level'].default_value=0
    bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    return m
ink=mat('Ink • midnight crease lines',(.001,.0005,.003))
molten=mat('Gold • emissive stone fissures',(1,.45,.025),14)
for name in ['polySurface11','polySurface14','pTorus3']:
    bs=bpy.data.objects[name].data.materials[0].node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Strength'].default_value=12

def curves(name,paths,material,radius):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=radius;c.bevel_resolution=0
    for path in paths:
        if len(path)<2:continue
        s=c.splines.new('POLY');s.points.add(len(path)-1)
        for point,co in zip(s.points,path):point.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    return bpy.context.object

# True silhouette/crease strokes, never every polygon edge. The terrain's
# triangulated ground grid is deliberately excluded from the line selection.
edge_count=0
for o in base:
    if o.name.startswith('Hero_'):continue
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bm.normal_update()
    deform=bm.verts.layers.deform.active
    ground=next((g.index for g in o.vertex_groups if g.name=='Rocky_Terrain'),None)
    lines=[]
    for e in bm.edges:
        if ground is not None and deform and all(v[deform].get(ground,0)>.5 for v in e.verts):continue
        a,b=[o.matrix_world@v.co for v in e.verts];mid=(a+b)*.5
        if (mid-camera.location).length>38:continue
        view=(camera.location-mid).normalized();faces=list(e.link_faces)
        normals=[o.matrix_world.to_3x3()@f.normal for f in faces]
        visible=any(n.dot(view)>.02 for n in normals)
        silhouette=len(faces)==1 or (len(faces)==2 and normals[0].dot(view)*normals[1].dot(view)<0)
        crease=len(faces)==2 and normals[0].dot(normals[1])<.82
        if visible and (silhouette or crease):lines.append([a,b])
    bm.free();edge_count+=len(lines)
    curves('Ink_Edges_'+o.name,lines,ink,.0026)

# Project drawn, branching strokes onto the actual rock/pillar surfaces.
# These add sparse internal detail rather than a full wireframe treatment.
arch=bpy.data.objects['Arena_Columns_Props_Towers'];positions=[arch.matrix_world@v.co for v in arch.data.vertices]
right=camera.matrix_world.to_3x3()@Vector((1,0,0));up=camera.matrix_world.to_3x3()@Vector((0,1,0));forward=camera.matrix_world.to_3x3()@Vector((0,0,-1))
def surface_strokes(group_name,glowing):
    group=arch.vertex_groups.get(group_name)
    if not group:return 0
    ids={v.index for v in arch.data.vertices if any(g.group==group.index and g.weight>.5 for g in v.groups)}
    faces=[list(p.vertices) for p in arch.data.polygons if all(v in ids for v in p.vertices)]
    if not faces:return 0
    tree=BVHTree.FromPolygons(positions,faces)
    center=sum((positions[i] for i in ids),Vector())/len(ids)
    sx=(max(positions[i].dot(right) for i in ids)-min(positions[i].dot(right) for i in ids))*.5
    sy=(max(positions[i].dot(up) for i in ids)-min(positions[i].dot(up) for i in ids))*.5
    distance=(center-camera.location).length
    drawings=[[(.02,.72),(-.09,.44),(.07,.18),(-.11,-.06),(.14,-.34),(.05,-.68)],
              [(.07,.18),(.32,.30),(.5,.18)],
              [(-.11,-.06),(-.35,-.20),(-.49,-.16)]]
    if not glowing:drawings=drawings[:2]
    paths=[];light_hits=[]
    for drawing in drawings:
        current=[]
        # Sampling follows changes in face angle, so lines sit on the surface.
        for a,b in zip(drawing,drawing[1:]):
            for k in range(8):
                t=k/7;u=a[0]*(1-t)+b[0]*t;v=a[1]*(1-t)+b[1]*t
                origin=center+right*(u*sx)+up*(v*sy)-forward*12
                hit,normal,_,_=tree.ray_cast(origin,forward,30)
                if hit:
                    current.append(hit+normal*.004)
                    if glowing:light_hits.append((hit,normal))
                elif current:
                    paths.append(current);current=[]
        if current:paths.append(current)
    radius=.0035*max(1,min(2,distance/5)) if glowing else .0018
    curves(('Gold_Crack_' if glowing else 'Ink_Detail_')+group_name,paths,molten if glowing else ink,radius)
    if glowing and light_hits:
        hit,normal=light_hits[len(light_hits)//2]
        bpy.ops.object.light_add(type='POINT',location=hit+normal*.09);light=bpy.context.object;light.name='Gold crack spill '+group_name
        light.data.energy=12 if distance<7 else 28;light.data.color=(1,.34,.055);light.data.shadow_soft_size=.35
    return len(paths)

crack_count=sum(surface_strokes(name,True) for name in ['pCube8','pCylinder4.002','pCylinder4.009','Atmosphere_Tower_02'])
ink_count=sum(surface_strokes(name,False) for name in ['pCube9','pCube11','pCylinder4','pCylinder4.005','pCube8'])
for x in [-.95,.95]:
    bpy.ops.object.light_add(type='POINT',location=(x,1.88,.8));o=bpy.context.object;o.name='Rune amber spill';o.data.energy=18;o.data.color=(1,.38,.065);o.data.shadow_soft_size=.45
scene.compositing_node_group.nodes.get('Glare').inputs['Threshold'].default_value=.7
scene.compositing_node_group.nodes.get('Glare').inputs['Strength'].default_value=1.2
scene.compositing_node_group.nodes.get('Glare').inputs['Size'].default_value=.18
scene.cycles.samples=80
scene.render.filepath=str(OUT/'arena-ink-glow.png');bpy.ops.render.render(write_still=True)
assert before=={o.name:geometry_hash(o) for o in base}
assert camera_matrix==camera.matrix_world
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(o.type=='MESH' or o==camera or (o.type=='LIGHT' and o.data.type=='POINT'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena-ink-glow.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena-ink-glow.blend'))
(OUT/'ink-glow-report.json').write_text(json.dumps({'original_geometry_and_placements_unchanged':True,'camera_unchanged':True,'crease_segments':edge_count,'ink_detail_paths':ink_count,'emissive_crack_paths':crack_count,'rune_emission_strength':12},indent=2))
