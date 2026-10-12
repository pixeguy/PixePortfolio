"""Align front-page clip hips in place, keeping vertical sit/stand motion."""
import bpy
from pathlib import Path
from shutil import copy2


def correct_hips(rig, actions):
    clips = {action.name.split('|')[-1]: action for action in actions}
    hips = rig.pose.bones['mixamorig:Hips']
    samples = {}
    for name, action in clips.items():
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        frames = range(int(action.frame_range[0]), int(action.frame_range[1]) + 1)
        samples[name] = []
        for frame in frames:
            bpy.context.scene.frame_set(frame)
            samples[name].append((frame, (rig.matrix_world @ hips.matrix).copy()))
    standing = samples['Standing'][0][1].translation.copy()
    floor = samples['Floor'][0][1].translation.z
    seated = samples['Typing'][0][1].translation.z
    heights = {
        'Floor': (floor, floor), 'Standing': (standing.z, standing.z),
        'Typing': (seated, seated), 'Floor To Stand': (floor, standing.z),
        'Stand To Sit': (standing.z, seated), 'Sit To Type': (seated, seated),
        'Type To Sit': (seated, seated), 'Sit To Stand': (seated, standing.z),
    }
    for name, action in clips.items():
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        poses = samples[name]
        start, end = heights[name]
        start_delta = start - poses[0][1].translation.z
        end_delta = end - poses[-1][1].translation.z
        # Idle loops retain their vertical breathing rather than flattening it.
        if name in ('Floor', 'Standing', 'Typing'):
            end_delta = start_delta
        for index, (frame, matrix) in enumerate(poses):
            bpy.context.scene.frame_set(frame)
            progress = index / max(len(poses) - 1, 1)
            smooth = progress * progress * (3 - 2 * progress)
            position = matrix.translation.copy()
            position.x, position.y = standing.x, standing.y
            position.z += start_delta + (end_delta - start_delta) * smooth
            matrix.translation = position
            hips.matrix = rig.matrix_world.inverted() @ matrix
            hips.keyframe_insert(data_path='location', frame=frame, group=hips.name)
    return clips


if __name__ == '__main__':
    directory = Path(__file__).resolve().parent
    target = directory / 'Standing Up Combined.fbx'
    backup = directory / 'Standing Up Combined.before-hip-fix.fbx.bak'
    if not backup.exists():
        copy2(target, backup)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(target))
    rig = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')
    clips = correct_hips(rig, list(bpy.data.actions))
    for action in clips.values():
        action.name = action.name.split('|')[-1]
        action.use_fake_user = True
    rig.animation_data.action = clips['Standing']
    rig.animation_data.action_slot = clips['Standing'].slots[0]
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_set(1)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj == rig or (obj.type == 'MESH' and obj.name == 'Alpha_Surface'))
    temporary = directory / 'Standing Up Combined.hips-fixed.fbx'
    bpy.ops.export_scene.fbx(filepath=str(temporary), use_selection=True, object_types={'ARMATURE', 'MESH'},
        add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True,
        bake_anim_use_nla_strips=False, bake_anim_simplify_factor=0, path_mode='STRIP')
    temporary.replace(target)
    print('HIP_CORRECTION_EXPORTED', sorted(clips))
