import bpy, json, runpy
from pathlib import Path

tools_directory = Path(__file__).resolve().parent
directory = tools_directory.parent / 'assets'
source_directory = directory / 'sources/front-animations'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(directory / 'portfolio-character.fbx'))
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
retained = set(bpy.data.objects)
sources = {
    'Stand To Sit': 'Stand To Sit.fbx', 'Sit To Type': 'Sit To Type.fbx', 'Typing': 'Typing.fbx',
    'Type To Sit': 'Type To Sit.fbx', 'Sit To Stand': 'Sit To Stand.fbx',
    'Stand To Fight': 'Standing Idle To Fight Idle.fbx', 'Fighting Idle': 'Fighting Idle.fbx',
    'Fight To Stand': 'Fight Idle To Standing Idle.fbx',
    'Jogging': 'Jogging.fbx',
}
new_names = list(sources)
clips = []
for action in list(bpy.data.actions):
    if action.name.split('|')[-1] in new_names:
        if rig.animation_data.action == action: rig.animation_data.action = None
        bpy.data.actions.remove(action)
    else: clips.append(action)
for action in clips:
    name = action.name.lower()
    action.name = 'Standing' if 'looking around' in name else 'Floor' if 'sitting idle' in name else 'Floor To Stand' if 'standing up' in name else action.name.split('|')[-1]
    action.use_fake_user = True

for name, filename in sources.items():
    previous_objects = set(bpy.data.objects)
    previous_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(source_directory / filename))
    imported = set(bpy.data.objects) - previous_objects
    source = next(o for o in imported if o.type == 'ARMATURE')
    source_action = source.animation_data.action
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
        if bone.name in source.pose.bones:
            constraint = bone.constraints.new('COPY_TRANSFORMS')
            constraint.target = source
            constraint.subtarget = bone.name
            constraint.owner_space = 'WORLD'
            constraint.target_space = 'WORLD'
    for obj in bpy.context.scene.objects: obj.select_set(obj == rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.nla.bake(frame_start=int(source_action.frame_range[0]), frame_end=int(source_action.frame_range[1]),
        step=1, only_selected=False, visual_keying=True, clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    action = rig.animation_data.action
    action.name = name
    action.use_fake_user = True
    clips.append(action)
    for obj in imported: bpy.data.objects.remove(obj, do_unlink=True)
    for unused in set(bpy.data.actions) - previous_actions - {action}: bpy.data.actions.remove(unused)

runpy.run_path(str(tools_directory / 'fix-front-hips.py'))['correct_hips'](rig, clips)
rig.animation_data.action = clips[0]
rig.animation_data.action_slot = clips[0].slots[0]
bpy.context.scene.render.fps = 30
bpy.context.scene.frame_set(1)
for obj in bpy.context.scene.objects:
    obj.select_set(obj in retained and (obj == rig or (obj.type == 'MESH' and obj.name in {'Alpha_Surface', 'Alpha_Joints'})))
temporary = directory / 'portfolio-character.expanded.fbx'
bpy.ops.export_scene.fbx(filepath=str(temporary), use_selection=True, object_types={'ARMATURE', 'MESH'},
    add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
    bake_anim_simplify_factor=0, path_mode='STRIP')
temporary.replace(directory / 'portfolio-character.fbx')
print('COMBINED_ANIMATIONS ' + json.dumps([{'name': a.name, 'frames': list(a.frame_range)} for a in clips]))
