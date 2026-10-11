import bpy,json
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath='E:/pixeguy/Downloads/Standing Up.fbx')
a=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.ops.import_scene.fbx(filepath='E:/pixeguy/Downloads/Sitting Idle.fbx')
b=next(o for o in bpy.data.objects if o.type=='ARMATURE' and o!=a)
keys=set(a.data.bones.keys())&set(b.data.bones.keys())
worlddiff=max(abs((a.matrix_world@a.data.bones[k].matrix_local)[r][c]-(b.matrix_world@b.data.bones[k].matrix_local)[r][c]) for k in keys for r in range(4) for c in range(4))
print('TRANSFORM_INFO '+json.dumps({'a':list(a.scale),'b':list(b.scale),'world_difference':worlddiff,'a_hips':list(a.data.bones['mixamorig:Hips'].head_local),'b_hips':list(b.data.bones['mixamorig:Hips'].head_local)}))
