import bpy, json, sys
from pathlib import Path

source_directory = Path('E:/pixeguy/Downloads')
output_directory = Path('E:/pixeguy/Documents/GitHub/PixePortfolio/assets')
mesh_source = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source_directory / 'Standing Up.fbx'))
base_objects = set(bpy.data.objects)
rig = next(obj for obj in base_objects if obj.type == 'ARMATURE')
# A newer Standing Up source may include a mesh. Keep only the chosen model.
if mesh_source and mesh_source != 'Standing Up':
    for obj in list(base_objects):
        if obj.type == 'MESH':
            base_objects.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)
base_bones = set(rig.data.bones.keys())
base_matrices = {bone.name: bone.matrix_local.copy() for bone in rig.data.bones}
base_fps = bpy.context.scene.render.fps
standing_action = next((action for action in bpy.data.actions
                        if action.name.lower().split('|')[-1].strip() == 'standing up'),
                       rig.animation_data.action)
rig.animation_data.action = standing_action
rig.animation_data.action_slot = standing_action.slots[0]
for action in list(bpy.data.actions):
    if action != standing_action:
        bpy.data.actions.remove(action)
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
    source_bones = set(source_rig.data.bones.keys())
    missing = base_bones - source_bones
    if source_bones - base_bones or any(rig.data.bones[key].children or not key.endswith('_end') for key in missing):
        raise RuntimeError(name + ': deforming bone names differ from Standing Up')
    shared_bones = base_bones & source_bones
    difference = max(abs(source_rig.data.bones[key].matrix_local[row][col] - base_matrices[key][row][col])
                     for key in shared_bones for row in range(4) for col in range(4))
    rotation_difference = max(abs(source_rig.data.bones[key].matrix_local[row][col] - base_matrices[key][row][col])
                              for key in shared_bones for row in range(3) for col in range(3))
    report.setdefault('rig_comparison', []).append({'source': name, 'maximum_matrix_difference': difference, 'maximum_rotation_difference': rotation_difference})
    source_action = source_rig.animation_data.action
    if difference > 0.02 or rotation_difference > 0.001:
        # Bake world-space bone poses onto the updated Standing Up rest pose.
        for bone_name in shared_bones:
            constraint = rig.pose.bones[bone_name].constraints.new('COPY_TRANSFORMS')
            constraint.target = source_rig
            constraint.subtarget = bone_name
            constraint.owner_space = 'WORLD'
            constraint.target_space = 'WORLD'
        for obj in bpy.context.scene.objects:
            obj.select_set(obj == rig)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.nla.bake(frame_start=int(source_action.frame_range[0]),
            frame_end=int(source_action.frame_range[1]), step=1, only_selected=False,
            visual_keying=True, clear_constraints=True, use_current_action=False,
            bake_types={'POSE'})
        action = rig.animation_data.action
    else:
        action = source_action
    action.name = name
    action.use_fake_user = True
    clips.append(action)
    if mesh_source == name:
        # Rebind the chosen mesh to the target rest pose before removing its rig.
        if difference > 0.02 or rotation_difference > 0.001:
            rig.animation_data.action = None
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
            source_rig.animation_data.action = None
            for bone_name in shared_bones:
                constraint = source_rig.pose.bones[bone_name].constraints.new('COPY_TRANSFORMS')
                constraint.target = rig
                constraint.subtarget = bone_name
                constraint.owner_space = 'WORLD'
                constraint.target_space = 'WORLD'
            bpy.context.view_layer.update()
            for obj in imported:
                if obj.type != 'MESH':
                    continue
                for candidate in bpy.context.scene.objects:
                    candidate.select_set(candidate == obj)
                bpy.context.view_layer.objects.active = obj
                for modifier in list(obj.modifiers):
                    if modifier.type == 'ARMATURE' and modifier.object == source_rig:
                        bpy.ops.object.modifier_apply(modifier=modifier.name)
                modifier = obj.modifiers.new('Standing Up rig', 'ARMATURE')
                modifier.object = rig
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
temporary_export = output_directory / 'Standing Up Combined.rebuild.fbx'
bpy.ops.export_scene.fbx(filepath=str(temporary_export),
    use_selection=True, object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False,
    bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
    bake_anim_simplify_factor=0, path_mode='COPY', embed_textures=True)
temporary_export.replace(output_directory / 'Standing Up Combined.fbx')
(output_directory / 'Standing Up Combined.json').write_text(json.dumps(report, indent=2))
print('COMBINED_FBX ' + json.dumps(report))
