"""Build the complete space arena with supporting terrain and dedicated PBR maps."""
import bpy, math, random, json, sys, tempfile, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/poseidon-space-arena'
OUT.mkdir(exist_ok=True)
(ROOT/'tools/arena-work').mkdir(exist_ok=True)
tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(ROOT/'assets/Poseidon ARENA with floor.fbx'))
bpy.context.view_layer.update()
def ancestry(o):
    result=[]
    while o: result.append(o.name); o=o.parent
    return result
# BG_OBJECTS is part of the playable arena: it includes the colonnade and
# second portal. Only OUTER_BG and the giant plane are surrounding scenery.
tower_sources=[]
for o in bpy.data.objects:
    if o.type=='MESH' and 'OUTER_BG' in ancestry(o) and o.name.startswith('pCylinder') and len(o.data.polygons)>400:
        tower_sources.append((o.name,o.data.copy(),o.matrix_world.copy()))
remove=[o for o in bpy.data.objects if 'OUTER_BG' in ancestry(o) or o.name=='FLOOR']
removed_names=[o.name for o in remove]
for o in remove: bpy.data.objects.remove(o,do_unlink=True)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
original_polygons=sum(len(o.data.polygons) for o in meshes)
normalization=Matrix.Scale(10,4) @ Matrix.Translation(Vector((12.800006,0,0)))
for o in meshes:
    world=o.matrix_world.copy(); o.parent=None
    o.data.transform(normalization @ world); o.matrix_world=Matrix.Identity(4)
    if o.data.uv_layers: o.data.uv_layers.active.name='SourceUV'
for o in list(bpy.data.objects):
    if o.type!='MESH': bpy.data.objects.remove(o,do_unlink=True)

# Rasterize original, angular rune strokes into planar mask textures. These
# are used only during baking; the delivered asset has no decal geometry.
def rune_mask(name, rx, ry, count, extent):
    size=1024
    canvas=np.zeros((size,size),dtype=np.float32)
    glyphs=[
        [((0,-1),(0,1)),((0,.8),(.6,.2)),((0,0),(-.6,.6))],
        [((-.6,-.8),(.6,.8)),((.6,.8),(-.6,.8)),((-.6,.8),(.6,-.8))],
        [((0,-1),(0,1)),((-.6,.2),(0,.8)),((0,.8),(.6,.2))],
        [((-.5,-1),(-.5,1)),((-.5,.8),(.6,.3)),((.6,.3),(-.5,-.1))],
        [((-.6,-.8),(0,.1)),((0,.1),(.6,-.8)),((0,.1),(0,1)),((-.5,.6),(.5,.6))],
        [((-.5,-1),(-.5,1)),((-.5,.7),(.5,.1)),((.5,.1),(-.5,-.4)),((.5,.1),(.5,-.8))],
        [((0,-1),(-.6,0)),((-.6,0),(0,1)),((0,1),(.6,0)),((.6,0),(0,-1))],
        [((-.6,-.8),(.6,.8)),((-.6,.8),(.6,-.8)),((0,0),(0,1))],
    ]
    # Use the same transformed ellipse as the actual mesh, including its
    # radial scaling. Glyphs have clear gaps; no enclosing circular line.
    for i in range(count):
        a=2*math.pi*i/count
        radial=np.array((math.cos(a),math.sin(a)))
        tangent=np.array((-math.sin(a),math.cos(a)))
        center=np.array((rx*math.cos(a),ry*math.sin(a)))
        height=.13 if name=='floor' else .075 if name=='ring' else .055
        width=height*.65
        for start,end in glyphs[(i*3+i//3)%len(glyphs)]:
            ends=[]
            for u,v in [start,end]:
                p=center+tangent*u*width+radial*v*height
                ends.append((p/np.array(extent)+1)*.5*(size-1))
            p,q=ends
            thickness=max(1.3,size*.0055 if name=='floor' else size*.006)
            lo=np.maximum(0,np.floor(np.minimum(p,q)-thickness-1).astype(int))
            hi=np.minimum(size-1,np.ceil(np.maximum(p,q)+thickness+1).astype(int))
            xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
            v=q-p; t=np.clip(((xx-p[0])*v[0]+(yy-p[1])*v[1])/max(np.dot(v,v),1e-8),0,1)
            d=np.sqrt((xx-p[0]-t*v[0])**2+(yy-p[1]-t*v[1])**2)
            patch=np.clip(thickness-d,0,1)
            canvas[lo[1]:hi[1]+1,lo[0]:hi[0]+1]=np.maximum(canvas[lo[1]:hi[1]+1,lo[0]:hi[0]+1],patch)
    pixels=np.ones((size,size,4),dtype=np.float32);pixels[:,:,:3]=canvas[:,:,None]
    img=bpy.data.images.new('RuneMask_'+name,width=size,height=size,alpha=True)
    img.colorspace_settings.name='Non-Color';img.pixels.foreach_set(pixels.ravel());img.update()
    return img

rune_specs={
    'floor':dict(center=(0,-.170972),radii=(1.69,1.344),count=20,extent=(2.1,1.75)),
    'ring':dict(center=(.00038,1.30083),radii=(1.20,.974),count=22,extent=(1.6,1.4)),
    'second':dict(center=(.000493,.467856),radii=(.785,.785),count=18,extent=(1.05,1.05)),
}
for name,s in rune_specs.items():s['image']=rune_mask(name,*s['radii'],s['count'],s['extent'])

def shader(name, special=None, rock=False):
    mat=bpy.data.materials.new(name); mat.use_nodes=True
    nt=mat.node_tree; nt.nodes.clear(); nodes=nt.nodes; links=nt.links
    def node(kind): return nodes.new(kind)
    def mathnode(op,a,b=None):
        n=node('ShaderNodeMath'); n.operation=op
        for i,v in enumerate([a,b]):
            if v is None: continue
            if isinstance(v,(float,int)): n.inputs[i].default_value=v
            else: links.new(v,n.inputs[i])
        return n.outputs[0]
    def image(suffix,noncolor=False):
        n=node('ShaderNodeTexImage'); n.image=bpy.data.images.load(str(ROOT/f'assets/Poseidon Arena_aiStandardSurface1_{suffix}.1001.png'),check_existing=True)
        if noncolor: n.image.colorspace_settings.name='Non-Color'
        uv=node('ShaderNodeUVMap'); uv.uv_map='SourceUV'; links.new(uv.outputs['UV'],n.inputs['Vector'])
        return n.outputs['Color']
    out=node('ShaderNodeOutputMaterial'); bs=node('ShaderNodeBsdfPrincipled'); links.new(bs.outputs[0],out.inputs['Surface'])
    geo=node('ShaderNodeNewGeometry'); separate=node('ShaderNodeSeparateXYZ'); links.new(geo.outputs['Position'],separate.inputs[0])
    x,y,z=[separate.outputs[a] for a in 'XYZ']
    if rock:
        noise=node('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=3; noise.inputs['Detail'].default_value=1
        links.new(geo.outputs['Position'],noise.inputs['Vector']); luminance=noise.outputs['Fac']
        rough=.88; metallic=.05; ao=None
    else:
        bw=node('ShaderNodeRGBToBW'); links.new(image('BaseColor'),bw.inputs[0]); luminance=bw.outputs[0]
        rough=mathnode('MAXIMUM',image('Roughness',True),.88 if special=='floor' else .8); metallic=0; ao=image('Ambient Occlusion',True)
        normal=node('ShaderNodeNormalMap'); normal.uv_map='SourceUV'; normal.inputs['Strength'].default_value=.35 if special=='floor' else .55
        links.new(image('Normal',True),normal.inputs['Color']); links.new(normal.outputs[0],bs.inputs['Normal'])
    # Small-scale mineral grain survives a close, standing-height view.
    fine=node('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=32;fine.inputs['Detail'].default_value=3;fine.inputs['Roughness'].default_value=.72
    links.new(geo.outputs['Position'],fine.inputs['Vector'])
    bump=node('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.012
    links.new(fine.outputs['Fac'],bump.inputs['Height'])
    if not rock:links.new(normal.outputs[0],bump.inputs['Normal'])
    links.new(bump.outputs[0],bs.inputs['Normal'])
    ramp=node('ShaderNodeValToRGB'); links.new(luminance,ramp.inputs[0])
    ramp.color_ramp.elements[0].position=.03; ramp.color_ramp.elements[0].color=(.012,.009,.019,1)
    ramp.color_ramp.elements[1].position=.8; ramp.color_ramp.elements[1].color=(.12,.088,.16,1)
    mid=ramp.color_ramp.elements.new(.35); mid.color=(.045,.035,.065,1)
    color=ramp.outputs['Color']
    grain=node('ShaderNodeMixRGB');grain.blend_type='MULTIPLY';grain.inputs[0].default_value=.18
    links.new(color,grain.inputs[1]);links.new(fine.outputs['Fac'],grain.inputs[2]);color=grain.outputs[0]
    if ao:
        mix=node('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=.65
        links.new(color,mix.inputs[1]); links.new(ao,mix.inputs[2]); color=mix.outputs[0]
    # Warped fractures and weathered mineral beds supply medium-scale relief,
    # so the material reads as broken stone rather than smooth mottled paint.
    warp=node('ShaderNodeTexNoise');warp.inputs['Scale'].default_value=2.4;warp.inputs['Detail'].default_value=4;warp.inputs['Roughness'].default_value=.78
    links.new(geo.outputs['Position'],warp.inputs['Vector'])
    centered=node('ShaderNodeVectorMath');centered.operation='SUBTRACT';links.new(warp.outputs['Color'],centered.inputs[0]);centered.inputs[1].default_value=(.5,.5,.5)
    amplitude=node('ShaderNodeVectorMath');amplitude.operation='SCALE';links.new(centered.outputs[0],amplitude.inputs[0]);amplitude.inputs['Scale'].default_value=.24
    warped=node('ShaderNodeVectorMath');warped.operation='ADD';links.new(geo.outputs['Position'],warped.inputs[0]);links.new(amplitude.outputs[0],warped.inputs[1])
    voro=node('ShaderNodeTexVoronoi');voro.feature='DISTANCE_TO_EDGE';voro.inputs['Scale'].default_value=2.7;links.new(warped.outputs[0],voro.inputs['Vector'])
    crack=node('ShaderNodeMapRange');crack.interpolation_type='SMOOTHERSTEP';crack.clamp=True
    crack.inputs['From Min'].default_value=.005;crack.inputs['From Max'].default_value=.035;crack.inputs['To Min'].default_value=1;crack.inputs['To Max'].default_value=0
    links.new(voro.outputs['Distance'],crack.inputs['Value'])
    strata=node('ShaderNodeTexNoise');strata.inputs['Scale'].default_value=7;strata.inputs['Detail'].default_value=5;strata.inputs['Roughness'].default_value=.8
    links.new(warped.outputs[0],strata.inputs['Vector'])
    mineral=node('ShaderNodeMixRGB');mineral.blend_type='MULTIPLY';mineral.inputs[0].default_value=.4
    links.new(color,mineral.inputs[1]);links.new(strata.outputs['Fac'],mineral.inputs[2]);color=mineral.outputs[0]
    fissures=node('ShaderNodeMixRGB');links.new(mathnode('MULTIPLY',crack.outputs[0],.7),fissures.inputs[0]);links.new(color,fissures.inputs[1]);fissures.inputs[2].default_value=(.004,.003,.009,1);color=fissures.outputs[0]
    relief=mathnode('SUBTRACT',mathnode('MULTIPLY',strata.outputs['Fac'],.32),mathnode('MULTIPLY',crack.outputs[0],.5))
    chipped=node('ShaderNodeBump');chipped.inputs['Strength'].default_value=.65;chipped.inputs['Distance'].default_value=.09
    links.new(relief,chipped.inputs['Height']);links.new(bump.outputs[0],chipped.inputs['Normal']);links.new(chipped.outputs[0],bs.inputs['Normal'])
    if (OUT/'Rock_Albedo.png').exists():
        mapping=node('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs['Scale'].default_value=1/3
        links.new(geo.outputs['Position'],mapping.inputs[0])
        stone=node('ShaderNodeTexImage');stone.image=bpy.data.images.load(str(OUT/'Rock_Albedo.png'),check_existing=True);stone.projection='BOX';stone.projection_blend=.25
        links.new(mapping.outputs[0],stone.inputs['Vector'])
        natural=node('ShaderNodeMixRGB');natural.inputs[0].default_value=.88;links.new(color,natural.inputs[1]);links.new(stone.outputs['Color'],natural.inputs[2]);color=natural.outputs[0]
        height=node('ShaderNodeRGBToBW');links.new(stone.outputs['Color'],height.inputs[0])
        stone_bump=node('ShaderNodeBump');stone_bump.inputs['Strength'].default_value=.7;stone_bump.inputs['Distance'].default_value=.10
        links.new(height.outputs[0],stone_bump.inputs['Height']);links.new(bump.outputs[0],stone_bump.inputs['Normal']);links.new(stone_bump.outputs[0],bs.inputs['Normal'])
    mask=0
    if special:
        s=rune_specs[special]
        a=mathnode('SUBTRACT',x,s['center'][0]); b=mathnode('SUBTRACT',y if special=='floor' else z,s['center'][1])
        uv=node('ShaderNodeCombineXYZ')
        links.new(mathnode('ADD',mathnode('DIVIDE',a,s['extent'][0]*2),.5),uv.inputs['X'])
        links.new(mathnode('ADD',mathnode('DIVIDE',b,s['extent'][1]*2),.5),uv.inputs['Y'])
        tex=node('ShaderNodeTexImage');tex.image=s['image'];tex.extension='CLIP'; links.new(uv.outputs[0],tex.inputs['Vector'])
        sep_normal=node('ShaderNodeSeparateXYZ');links.new(geo.outputs['Normal'],sep_normal.inputs[0])
        facing=mathnode('GREATER_THAN',mathnode('ABSOLUTE',sep_normal.outputs['Z' if special=='floor' else 'Y']),.65)
        mask=mathnode('MULTIPLY',tex.outputs['Color'],facing)
        if special=='floor': mask=mathnode('MULTIPLY',mask,mathnode('GREATER_THAN',z,.025))
        # A dark groove around the luminous core gives an engraved appearance.
        mix=node('ShaderNodeMixRGB'); links.new(mask,mix.inputs[0]); links.new(color,mix.inputs[1]); mix.inputs[2].default_value=(.19,.11,.29,1); color=mix.outputs[0]
    emission=node('ShaderNodeMixRGB'); emission.inputs[1].default_value=(0,0,0,1); emission.inputs[2].default_value=(.45,.17,1,1)
    if isinstance(mask,int): emission.inputs[0].default_value=0
    else: links.new(mask,emission.inputs[0])
    links.new(color,bs.inputs['Base Color']); links.new(emission.outputs[0],bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value=3
    for value,key in [(rough,'Roughness'),(metallic,'Metallic')]:
        if isinstance(value,(float,int)): bs.inputs[key].default_value=value
        else: links.new(value,bs.inputs[key])
    return mat,{'BaseColor':color,'Roughness':rough,'Metallic':metallic,'Emissive':emission.outputs[0]},bs,out

standard=shader('Charcoal purple stone'); floor=shader('Engraved floor circle','floor'); hoop=shader('Engraved standing ring','ring'); second=shader('Second portal runes','second');rock=shader('Floating charcoal fragments',rock=True)
materials=[standard,floor,hoop,second,rock]
for o in meshes:
    o.data.materials.clear(); o.data.materials.append((floor if o.name=='polySurface11' else hoop if o.name=='polySurface14' else second if o.name=='pTorus3' else standard)[0])
random.seed(29)
# Embed the arena into a level bearing surface, then blend into the rocky
# perimeter. The walkway is lower than the first circular platform.
def terrain_height(x,y):
    rough=-.43+.32*math.sin(x*.67)*math.cos(y*.42)+.15*math.sin(x*1.71+y*.83)
    rough+=max(0,abs(x)-5)*.055
    if -3.5<y<20.3:
        grade=max(0,min(1,(y-1.7)/1.8))
        bearing=-.02-.54*grade
        distance=max(0,abs(x)-3.6)
        blend=min(1,distance/2)
        return bearing*(1-blend)+rough*blend
    return rough
# Reuse the removed perimeter architecture at an intimate, traversable scale.
for i in range(36):
    source_name,data,world=tower_sources[i%len(tower_sources)]
    mesh=data.copy(); mesh.transform(normalization @ world)
    ps=[v.co.copy() for v in mesh.vertices]
    lo=Vector([min(p[k] for p in ps) for k in range(3)]);hi=Vector([max(p[k] for p in ps) for k in range(3)])
    scale=random.uniform(4.5,8.5)/(hi.z-lo.z)
    center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    for v in mesh.vertices:v.co=(v.co-center)*scale
    o=bpy.data.objects.new(f'Atmosphere_Tower_{i+1:02d}',mesh);bpy.context.collection.objects.link(o)
    if i<14:
        tx=(-1 if i%2 else 1)*random.uniform(8,15);ty=-3+(i//2)*4+random.uniform(-1,1)
    else:
        tx=random.uniform(-20,20);ty=random.uniform(25,58)
    o.location=(tx,ty,terrain_height(tx,ty)-.18)
    o.rotation_euler.z=random.uniform(-.6,.6)
    if mesh.uv_layers:mesh.uv_layers.active.name='SourceUV'
    mesh.materials.clear();mesh.materials.append(standard[0]);meshes.append(o)

# Low-poly rocky ground extends beneath and around both circular areas.
nx,ny=37,65
verts=[];faces=[]
for j in range(ny):
    for i in range(nx):
        y=-10+70.65*j/(ny-1)
        half_width=18+6*max(0,(y-20)/40.65)
        x=-half_width+2*half_width*i/(nx-1)
        height=terrain_height(x,y)
        verts.append((x,y,height))
for j in range(ny-1):
    for i in range(nx-1):
        a=j*nx+i;b=a+1;c=a+nx;d=c+1
        faces.extend([(a,b,d),(a,d,c)] if (i+j)%2 else [(a,b,c),(b,d,c)])
boundary=list(range(nx))+[j*nx+nx-1 for j in range(1,ny)]+list(range((ny-1)*nx+nx-2,(ny-1)*nx-1,-1))+[j*nx for j in range(ny-2,0,-1)]
for k,a in enumerate(boundary):
    b=boundary[(k+1)%len(boundary)];pa=verts[a];pb=verts[b];c=len(verts)
    verts.extend([(pa[0]*.96,pa[1],-4.5+random.uniform(-.5,.5)),(pb[0]*.96,pb[1],-4.5+random.uniform(-.5,.5))]);faces.append((a,c,c+1,b))
mesh=bpy.data.meshes.new('Faceted terrain mesh');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Rocky_Terrain',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(rock[0]);meshes.append(o)
for i in range(92):
    if i<38:x=(-1 if i%2 else 1)*random.uniform(4,16);y=random.uniform(-6,26)
    else:x=random.uniform(-21,21);y=random.uniform(22,59)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(.45,1.6),location=(x,y,terrain_height(x,y)-.15))
    o=bpy.context.object;o.name=f'Terrain_Boulder_{i+1:02d}'
    for v in o.data.vertices:v.co*=random.uniform(.7,1.25)
    o.scale=(random.uniform(.8,1.4),random.uniform(.8,1.8),random.uniform(.5,1.6));o.rotation_euler.z=random.random()*6
    o.data.materials.append(rock[0]);meshes.append(o)
for i in range(16):
    side=-1 if i%2 else 1
    location=(side*random.uniform(2.5,4.8),random.uniform(-2,15),random.uniform(.65,4.1))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(.18,.48),location=location)
    o=bpy.context.object; o.name=f'Floating_Rock_{i+1:02d}'
    for v in o.data.vertices: v.co*=random.uniform(.78,1.25)
    o.scale=(random.uniform(.8,1.4),random.uniform(.7,1.3),random.uniform(.65,1.6)); o.rotation_euler=[random.random()*3 for _ in range(3)]
    o.data.materials.append(rock[0]); meshes.append(o)

# Consolidate small static pieces before atlas baking. Original object names
# remain as vertex groups for selecting and editing parts in Blender.
for material_info,name in [(standard,'Arena_Columns_Props_Towers'),(rock,'Terrain_and_Floating_Rocks')]:
    group=[o for o in meshes if o.data.materials[0]==material_info[0]]
    if not group:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:
        o.select_set(True);vg=o.vertex_groups.new(name=o.name);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join()
    joined=bpy.context.object;joined.name=name
    meshes=[o for o in meshes if o not in group]+[joined]

import runpy
scene=bpy.context.scene
targets=runpy.run_path(str(ROOT/'tools/arena-materials.py'))['build'](OUT,floor,hoop,second,standard)
# Presentation lighting is separate from the exported mesh; no sky geometry.
scene.world=bpy.data.worlds.new('Dark studio'); scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.018,.045,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
def aim(o,p): o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-.65,1.78)); camera=bpy.context.object; camera.name='Standing_In_First_Circle';aim(camera,(0,12,1.2));camera.data.type='PERSP';camera.data.lens=22;scene.camera=camera
for loc,color,power,size in [((0,-3,9),(.66,.55,1),2400,8),((4,10,7),(.42,.25,1),2400,6),((-5,2,5),(.35,.56,1),1800,5),((0,19,10),(.6,.45,1),3200,8),((0,39,14),(.5,.4,1),5000,14),((-10,55,12),(.4,.5,1),4000,12)]:
    bpy.ops.object.light_add(type='AREA',location=loc); light=bpy.context.object; light.data.energy=power;light.data.color=color;light.data.shape='DISK';light.data.size=size;aim(light,(0,4,0))
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.cycles.samples=48
scene.render.film_transparent=True
scene.render.filepath=str(OUT/'arena-standing.png'); bpy.ops.render.render(write_still=True)
camera.location=(40,-42,42);aim(camera,(0,24,0));camera.data.type='ORTHO';camera.data.ortho_scale=86
scene.render.filepath=str(OUT/'arena-preview.png');bpy.ops.render.render(write_still=True)
camera.location=(6,-8,6);aim(camera,(0,.5,.5));camera.data.ortho_scale=10
scene.render.filepath=str(OUT/'arena-detail.png');bpy.ops.render.render(write_still=True)
camera.location=(0,-.65,1.78);aim(camera,(0,12,1.2));camera.data.type='PERSP'
# Include the standing camera in the GLB so a viewer can use the intended view.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
camera.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'poseidon-space-arena.glb'),export_format='GLB',use_selection=True,export_cameras=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/'poseidon-space-arena.fbx'),use_selection=True,object_types={'MESH','CAMERA'},add_leaf_bones=False,path_mode='COPY',embed_textures=True,bake_anim=False)
for img in targets.values(): img.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'poseidon-space-arena.blend'))
(OUT/'build-report.json').write_text(json.dumps({'removed_objects':removed_names,'retained_original_polygons':original_polygons,'floating_rocks':16,'terrain_boulders':92,'reused_towers':36,'restored_group':'BG_OBJECTS','camera':'Standing_In_First_Circle','forward_terrain_end':60.65,'previous_forward_terrain_end':30,'floor_roughness':.9,'floor_metallic':0,'floor_texture_resolution':4096,'terrain_tile_size':4,'final_polygons':sum(len(o.data.polygons) for o in meshes)},indent=2))
