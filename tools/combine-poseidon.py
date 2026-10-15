"""Assemble independent body/trident and tail rigs, with active idle mapped to 0-60."""
import bpy
from pathlib import Path
from mathutils import Matrix

assets = Path(__file__).resolve().parent.parent / 'assets'
bpy.ops.wm.read_factory_settings(use_empty=True)
parts = []
for prefix, filename in [('Body', 'Poseidon_IdleV4_Body.fbx'), ('Tail', 'Poseidon_IdleV4_Tail.fbx')]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(assets / filename), anim_offset=0)
    imported = set(bpy.data.objects) - before
    rig = next(obj for obj in imported if obj.type == 'ARMATURE')
    meshes = [obj for obj in imported if obj.type == 'MESH' and not obj.name.startswith('shoe_')]
    props = [obj for obj in meshes if not any(mod.type == 'ARMATURE' for mod in obj.modifiers)]
    required = set()
    for mesh in meshes:
        for vertex in mesh.data.vertices:
            for weight in vertex.groups:
                name = mesh.vertex_groups[weight.group].name
                if weight.weight > .00001 and name in rig.data.bones: required.add(name)
    # Keep only the weighted branches and their actual parents. Common roots
    # remain where needed, but unique prefixes prevent cross-rig track binding.
    for name in list(required):
        parent = rig.data.bones[name].parent
        while parent:
            required.add(parent.name); parent = parent.parent
    start, end = rig.animation_data.action.frame_range
    samples = []
    for frame in range(61):
        source_frame = start + (end - start) * frame / 60
        whole = int(source_frame)
        bpy.context.scene.frame_set(whole, subframe=source_frame - whole)
        bpy.context.view_layer.update()
        samples.append((rig.matrix_world.copy(),
            {name: rig.pose.bones[name].matrix_basis.copy() for name in required},
            {obj: obj.matrix_world.copy() for obj in props}))
    parts.append((prefix, rig, meshes, props, required, samples))

retained = {obj for _, rig, meshes, _, _, _ in parts for obj in meshes + [rig]}
# All motion is already captured. Remove helper parents before editing bones so
# the dependency graph cannot retain references to branches being deleted.
for _, _, _, props, _, _ in parts:
    for prop in props:
        prop.parent = None
        prop.matrix_parent_inverse = Matrix.Identity(4)
for obj in list(bpy.data.objects):
    if obj not in retained: bpy.data.objects.remove(obj, do_unlink=True)
scene = bpy.context.scene
scene.name = 'Idle'
scene.render.fps = 24
scene.frame_start, scene.frame_end = 0, 60
for prefix, rig, meshes, props, required, samples in parts:
    retained.update(meshes); retained.add(rig)
    rig.animation_data_clear()
    for obj in scene.objects: obj.select_set(obj == rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in list(rig.data.edit_bones):
        if bone.name not in required: rig.data.edit_bones.remove(bone)
    mapping = {name: prefix + '_' + name for name in required}
    for bone in rig.data.edit_bones: bone.name = mapping[bone.name]
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.name = prefix + '_Rig'
    rig.rotation_mode = 'QUATERNION'
    for mesh in meshes:
        mesh.name = prefix + '_' + mesh.name
        for group in mesh.vertex_groups:
            if group.name in mapping: group.name = mapping[group.name]
    for name in required: rig.pose.bones[mapping[name]].rotation_mode = 'QUATERNION'
    for prop in props:
        prop.animation_data_clear(); prop.parent = None
        prop.matrix_parent_inverse = Matrix.Identity(4)
        prop.rotation_mode = 'QUATERNION'
    for frame, (world, poses, prop_worlds) in enumerate(samples):
        rig.location, rig.rotation_quaternion, rig.scale = world.decompose()
        for channel in ['location', 'rotation_quaternion', 'scale']: rig.keyframe_insert(channel, frame=frame)
        for name, basis in poses.items():
            bone = rig.pose.bones[mapping[name]]
            bone.location, bone.rotation_quaternion, bone.scale = basis.decompose()
            for channel in ['location', 'rotation_quaternion', 'scale']: bone.keyframe_insert(channel, frame=frame)
        for prop, matrix in prop_worlds.items():
            prop.location, prop.rotation_quaternion, prop.scale = matrix.decompose()
            for channel in ['location', 'rotation_quaternion', 'scale']: prop.keyframe_insert(channel, frame=frame)
    rig.animation_data.action.name = prefix + '_Idle'
    print('PART', prefix, 'kept bones', len(required), 'meshes', len(meshes), 'source frames', start, end)

used_actions = {obj.animation_data.action for obj in retained if obj.animation_data and obj.animation_data.action}
for obj in list(bpy.data.objects):
    if obj not in retained: bpy.data.objects.remove(obj, do_unlink=True)
for action in list(bpy.data.actions):
    if action not in used_actions: bpy.data.actions.remove(action)
scene.frame_set(0)
for obj in scene.objects: obj.select_set(obj in retained)
bpy.ops.export_scene.fbx(filepath=str(assets / 'soul-be-it-poseidon-idle.fbx'),
    use_selection=True, object_types={'MESH', 'ARMATURE'}, add_leaf_bones=False,
    bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
    bake_anim_simplify_factor=0, path_mode='STRIP')
print('POSEIDON_EXPORT: independent pruned rigs, synchronized Idle 0-60, ankle pieces removed')
