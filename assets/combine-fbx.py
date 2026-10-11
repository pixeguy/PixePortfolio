import bpy, json, sys
from pathlib import Path

source_directory = Path('E:/pixeguy/Downloads')
output_directory = Path('E:/pixeguy/Documents/GitHub/PixePortfolio/assets')
mesh_source = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source_directory / 'Standing Up.fbx'))
base_objects = set(bpy.data.objects)
rig = next(obj for obj in base_objects if obj.type == 'ARMATURE')
base_bones = set(rig.data.bones.keys())
base_matrices = {bone.name: bone.matrix_local.copy() for bone in rig.data.bones}
base_fps = bpy.context.scene.render.fps
standing_action = rig.animation_data.action
standing_action.name = 'Standing Up'
standing_action.use_fake_user = True
clips = [standing_action]
report = {'model_source': mesh_source, 'rig_source': 'Standing Up', 'clips': []}

for name in ['Sitting Idle', 'Looking Around']:
    before = set(bpy.data.objects)
    previous_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(source_directory / (name + '.fbx')))
    imported = set(bpy.data.objects) - before
    source_rig = next(obj for obj in imported if obj.type == 'ARMATURE')
    if set(source_rig.data.bones.keys()) != base_bones:
        raise RuntimeError(name + ': bone names differ from Standing Up')
    difference = max(abs(source_rig.data.bones[key].matrix_local[row][col] - base_matrices[key][row][col])
                     for key in base_bones for row in range(4) for col in range(4))
    rotation_difference = max(abs(source_rig.data.bones[key].matrix_local[row][col] - base_matrices[key][row][col])
                              for key in base_bones for row in range(3) for col in range(3))
    report.setdefault('rig_comparison', []).append({'source': name, 'maximum_matrix_difference': difference, 'maximum_rotation_difference': rotation_difference})
    if difference > 0.02 or rotation_difference > 0.001:
        raise RuntimeError(name + ': rest poses differ; retargeting required, maximum difference ' + str(difference))
    action = source_rig.animation_data.action
    action.name = name
    action.use_fake_user = True
    clips.append(action)
    if mesh_source == name:
        for obj in imported:
            if obj.type != 'MESH':
                continue
            world = obj.matrix_world.copy()
            if obj.parent == source_rig:
                obj.parent = rig
                obj.matrix_world = world
            for modifier in obj.modifiers:
                if modifier.type == 'ARMATURE' and modifier.object == source_rig:
                    modifier.object = rig
            base_objects.add(obj)
    for obj in imported - base_objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for unused in set(bpy.data.actions) - previous_actions - {action}:
        bpy.data.actions.remove(unused)

# Each clip remains a separate named animation take on the sole retained rig.
rig.animation_data.action = standing_action
rig.animation_data.action_slot = standing_action.slots[0]
bpy.context.scene.render.fps = base_fps
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = int(standing_action.frame_range[1])
bpy.context.scene.frame_set(1)
for action in clips:
    report['clips'].append({'name': action.name, 'frames': list(action.frame_range),
                            'duration_seconds': (action.frame_range[1] - action.frame_range[0]) / base_fps})
for obj in bpy.context.scene.objects:
    obj.select_set(obj in base_objects)
bpy.context.view_layer.objects.active = rig
report['mesh_count'] = sum(obj.type == 'MESH' for obj in base_objects)
report['rig_count'] = sum(obj.type == 'ARMATURE' for obj in base_objects)
report['bone_count'] = len(rig.data.bones)
report['fps'] = base_fps
bpy.ops.wm.save_as_mainfile(filepath=str(output_directory / 'Standing Up Combined.blend'))
bpy.ops.export_scene.fbx(filepath=str(output_directory / 'Standing Up Combined.fbx'),
    use_selection=True, object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False,
    bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
    bake_anim_simplify_factor=0, path_mode='COPY', embed_textures=True)
(output_directory / 'Standing Up Combined.json').write_text(json.dumps(report, indent=2))
print('COMBINED_FBX ' + json.dumps(report))
