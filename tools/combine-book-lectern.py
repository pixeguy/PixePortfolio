"""Combine the supplied open-book and lectern FBXs into one grounded prop."""
import bpy, math, tempfile
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/book-lectern';OUT.mkdir(exist_ok=True)
tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.read_factory_settings(use_empty=True)

def import_meshes(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(path))
    objects=[o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();meshes=[]
    for o in objects:
        if o.type!='MESH':continue
        evaluated=o.evaluated_get(dg)
        mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=dg)
        mesh.transform(evaluated.matrix_world)
        fresh=bpy.data.objects.new(o.name+' baked',mesh);bpy.context.collection.objects.link(fresh);meshes.append(fresh)
    for o in objects:
        bpy.data.objects.remove(o,do_unlink=True)
    return meshes

def bounds(objects):
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    return Vector(tuple(min(p[a] for p in points) for a in range(3))),Vector(tuple(max(p[a] for p in points) for a in range(3)))

lectern=import_meshes(next((ROOT/'assets/lectern').glob('*.fbx')))
low,high=bounds(lectern);scale=1.05/(high.z-low.z)
transform=Matrix.Scale(scale,4)@Matrix.Translation(Vector((-(low.x+high.x)/2,-(low.y+high.y)/2,-low.z)))
for o in lectern:o.data.transform(transform);o.name='Lectern'
o=lectern[0];o.data.update()
faces=[p for p in o.data.polygons if p.center.z>.68 and p.normal.z>.45]
top=max(faces,key=lambda p:p.area)
print('LECTERN_TOP',tuple(top.center),tuple(top.normal),top.area)
print('TOP_FACES',[(tuple(round(n,3) for n in p.center),tuple(round(n,3) for n in p.normal),round(p.area,4)) for p in sorted(faces,key=lambda p:p.area,reverse=True)[:6]])

book=import_meshes(next((ROOT/'assets/Antique Book open/Antique Book open').glob('*.fbx')))
main=[o for o in book if o.name.startswith(('Book_frame','Book_sheets'))]
low,high=bounds(main);center=(low+high)*.5;width=high.x-low.x
# Only the cover and pages belong to this prop; discard key, quill and ornaments.
for o in book:
    if o not in main:bpy.data.objects.remove(o,do_unlink=True)
book=main
low,high=bounds(main);bookScale=.36/(high.x-low.x)
bookCenter=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
# The FBX cover already has a slope. Align its actual underside normal to the
# lectern normal instead of applying a second slope to the whole book.
normal=top.normal.normalized();support=top.center+normal*.0005
# Seat the broad underside of the cover, ignoring small binding ornaments.
frame=next(o for o in main if o.name.startswith('Book_frame'))
frame.data.update()
bottoms=[p for p in frame.data.polygons if p.normal.z < -.8]
cover=max(bottoms,key=lambda p:p.area)
bookCenter.z=cover.center.z-(cover.normal.x*(bookCenter.x-cover.center.x)+cover.normal.y*(bookCenter.y-cover.center.y))/cover.normal.z
rotation=(-cover.normal).rotation_difference(normal).to_matrix().to_4x4()
print('BOOK_CONTACT',tuple(cover.center),cover.area)
for o in book:
    o.data.transform(Matrix.Translation(support)@rotation@Matrix.Scale(bookScale,4)@Matrix.Translation(-bookCenter))
    o.name='Open book • '+o.name
frame.data.update()
contact=[normal.dot(frame.data.vertices[i].co-top.center) for i in cover.vertices]
assert max(abs(d-.0005) for d in contact)<.00001, contact
print('COVER_CONTACT_CLEARANCE',contact)

def image(path,color=True):
    im=bpy.data.images.load(str(path),check_existing=True)
    im.colorspace_settings.name='sRGB' if color else 'Non-Color'
    factor=min(1,1024/max(im.size));im.scale(max(1,int(im.size[0]*factor)),max(1,int(im.size[1]*factor)))
    im.filepath_raw=str(OUT/(('Lectern_' if 'lectern' in str(path) else 'Book_')+path.name))
    im.file_format='PNG';im.save();im.pack();return im

def material(name,directory,baseName,normalName,roughName,tint):
    m=bpy.data.materials.new(name);m.use_nodes=True
    nt=m.node_tree;bs=nt.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.85
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=image(directory/baseName)
    # Export a conventional texture connection; runtime supplies the colour tint.
    nt.links.new(tex.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Base Color'].default_value=(*tint,1)
    norm=nt.nodes.new('ShaderNodeTexImage');norm.image=image(directory/normalName,False)
    n=nt.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.45
    nt.links.new(norm.outputs['Color'],n.inputs['Color']);nt.links.new(n.outputs['Normal'],bs.inputs['Normal'])
    return m

ld=ROOT/'assets/lectern';bd=ROOT/'assets/Antique Book open/Antique Book open'
lm=bpy.data.materials.new('Lectern • violet ruin stone');lm.use_nodes=True
bs=lm.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.92
colour=lm.node_tree.nodes.new('ShaderNodeVertexColor');colour.layer_name='LecternStone'
lm.node_tree.links.new(colour.outputs['Color'],bs.inputs['Base Color'])
for o in lectern:
    attr=o.data.color_attributes.new(name='LecternStone',type='FLOAT_COLOR',domain='CORNER')
    for face in o.data.polygons:
        for li in face.loop_indices:
            z=o.data.vertices[o.data.loops[li].vertex_index].co.z
            t=max(0,min(1,(z-.78)/.22))
            base=Vector((.105,.075,.17)).lerp(Vector((.23,.13,.24)),t)
            variation=.94+.06*max(0,face.normal.z)
            attr.data[li].color=(*[v*variation for v in base],1)

bm=material('Book • parchment and binding',bd,'BaseColor.png','Normal.png','',(.92,.82,.65))
for objects,mat in [(lectern,lm),(book,bm)]:
    for o in objects:o.data.materials.clear();o.data.materials.append(mat)

bpy.ops.object.select_all(action='DESELECT')
for o in lectern+book:o.select_set(True)
bpy.context.view_layer.objects.active=lectern[0];bpy.ops.object.join();bpy.context.object.name='Book and lectern'
bpy.ops.export_scene.gltf(filepath=str(OUT/'book-lectern.glb'),export_format='GLB',use_selection=True,export_animations=False)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'book-lectern.blend'))
# Authoring preview only; it is not part of the website.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world=bpy.data.worlds.new('Preview world');scene.world.color=(.12,.10,.16)
bpy.ops.object.light_add(type='AREA',location=(2,-3,4));bpy.context.object.data.energy=500;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.object.camera_add(location=(1.6,-2.2,1.65));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT/'tools/arena-work/book-lectern-preview.png');bpy.ops.render.render(write_still=True)
print('Combined meshes:',len(lectern+book))
