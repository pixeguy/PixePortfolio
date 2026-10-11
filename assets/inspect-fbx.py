import bpy, json
sources = ['Standing Up', 'Sitting Idle', 'Looking Around']
for name in sources:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath='E:/pixeguy/Downloads/'+name+'.fbx')
    print('FBX_INFO '+json.dumps({'source':name,'objects':[(o.name,o.type,len(o.data.bones) if o.type=='ARMATURE' else len(o.data.vertices) if o.type=='MESH' else 0) for o in bpy.data.objects], 'actions':[(a.name,a.frame_range[:],[(slot.identifier,slot.target_id_type) for slot in a.slots]) for a in bpy.data.actions]}))
