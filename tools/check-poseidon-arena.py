import bpy,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
scene=bpy.context.scene
terrain=bpy.data.objects['Terrain_and_Floating_Rocks'];group=terrain.vertex_groups['Rocky_Terrain'].index
ground_verts={v.index for v in terrain.data.vertices if any(g.group==group and g.weight>.5 for g in v.groups)}
polygons=[list(p.vertices) for p in terrain.data.polygons if all(v in ground_verts for v in p.vertices)]
ground=BVHTree.FromPolygons([terrain.matrix_world@v.co for v in terrain.data.vertices],polygons)
floor=bpy.data.objects['polySurface11'];floor_bvh=BVHTree.FromPolygons([floor.matrix_world@v.co for v in floor.data.vertices],[list(p.vertices) for p in floor.data.polygons])
contacts=[]
for y in [0,5,10,15,19]:
    g=ground.ray_cast(Vector((0,y,20)),Vector((0,0,-1)))[0]
    f=floor_bvh.ray_cast(Vector((0,y,-5)),Vector((0,0,1)))[0]
    contacts.append({'y':y,'ground':round(g.z,4) if g else None,'floor_bottom':round(f.z,4) if f else None,'gap':round(f.z-g.z,4) if f and g else None})
mat=floor.data.materials[0];bs=mat.node_tree.nodes.get('Principled BSDF')
report={'ground_contacts':contacts,'floor_roughness':bs.inputs['Roughness'].default_value,'floor_metallic':bs.inputs['Metallic'].default_value,'ground_y_bounds':[min(terrain.data.vertices[i].co.y for i in ground_verts),max(terrain.data.vertices[i].co.y for i in ground_verts)],'images':{img.name:list(img.size) for img in bpy.data.images if img.packed_file and img.name.startswith(('Floor','Architecture','Ring','SecondRing','TerrainTile'))},'materials':[]}
for o in scene.objects:
    if o.type!='MESH':continue
    m=o.data.materials[0];n=m.node_tree.nodes.get('Principled BSDF');report['materials'].append({'object':o.name,'roughness':n.inputs['Roughness'].default_value,'metallic':n.inputs['Metallic'].default_value,'emission_strength':n.inputs['Emission Strength'].default_value})
print('CHECK',json.dumps(report,indent=2))
assert all(c['gap'] is not None and c['gap']<=.025 for c in contacts), 'Arena floats above ground'
assert bs.inputs['Roughness'].default_value>=.89 and bs.inputs['Metallic'].default_value==0
