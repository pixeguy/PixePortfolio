import bpy, json
for name in ['Standing Up','Sitting Idle']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath='E:/pixeguy/Downloads/'+name+'.fbx')
    rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    print('RIG_NAMES '+json.dumps({'source':name,'bones':list(rig.data.bones.keys())}))
