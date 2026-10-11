import bpy, json
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath='E:/pixeguy/Documents/GitHub/PixePortfolio/assets/Standing Up Combined.fbx')
print('EXPORTED_CONTENT '+json.dumps({'rigs':[(o.name,len(o.data.bones)) for o in bpy.data.objects if o.type=='ARMATURE'], 'meshes':[(o.name,len(o.data.vertices)) for o in bpy.data.objects if o.type=='MESH'], 'animations':[(a.name,list(a.frame_range)) for a in bpy.data.actions]}))
