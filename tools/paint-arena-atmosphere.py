"""Painted stone ink and architectural emission, with directional cinematic light.

Starts from the clean stylized scene: no environmental line geometry survives.
Ink and architectural fissures are PNG atlases with explicit UVs. No hatching.
"""
import bpy, math, random, tempfile, json
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/poseidon-space-arena'
(ROOT/'tools/arena-work').mkdir(exist_ok=True)
tempfile.tempdir=str(ROOT/'tools/arena-work')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'arena-stylized.blend'))
scene=bpy.context.scene; camera=scene.camera
right=camera.matrix_world.to_3x3()@Vector((1,0,0))
up=camera.matrix_world.to_3x3()@Vector((0,1,0))
forward=camera.matrix_world.to_3x3()@Vector((0,0,-1))
records=[]; crack_lights=[]

def stroke(tile,points,width,color):
    """Rasterize uneven tapered brush marks directly into texture pixels."""
    n=tile.shape[0]
    for i,(a,b) in enumerate(zip(points,points[1:])):
        a=np.array(a)*(n-1); b=np.array(b)*(n-1)
        w=width*(.72+.28*math.sin(i*2.7+1))
        lo=np.maximum(0,np.floor(np.minimum(a,b)-w-2).astype(int))
        hi=np.minimum(n,np.ceil(np.maximum(a,b)+w+2).astype(int))
        if np.any(hi<=lo):continue
        yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]]
        ab=b-a;t=np.clip(((xx-a[0])*ab[0]+(yy-a[1])*ab[1])/max(float(ab@ab),1e-6),0,1)
        dist=np.sqrt((xx-a[0]-t*ab[0])**2+(yy-a[1]-t*ab[1])**2)
        alpha=np.clip(w+.65-dist,0,1)[:,:,None]
        block=tile[lo[1]:hi[1],lo[0]:hi[0],:3]
        block[:]=block*(1-alpha)+np.array(color)*alpha

def image(name,pixels):
    h,w=pixels.shape[:2];im=bpy.data.images.new(name,width=w,height=h,alpha=False)
    im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(pixels.ravel()); im.update()
    im.filepath_raw=str(OUT/(name+'.png'));im.file_format='PNG';im.save();im.pack()
    return im

for objname in ['Arena_Columns_Props_Towers','Terrain_and_Floating_Rocks']:
    o=bpy.data.objects[objname];mesh=o.data
    positions=[o.matrix_world@v.co for v in mesh.vertices]
    groups={g.index:[] for g in o.vertex_groups}
    for v in mesh.vertices:
        for g in v.groups:
            if g.weight>.5:groups[g.group].append(v.index);break
    chosen=[]
    for group in o.vertex_groups:
        ids=groups[group.index]
        if not ids or group.name=='Rocky_Terrain':continue
        center=sum((positions[i] for i in ids),Vector())/len(ids)
        if (center-camera.location).length<32:chosen.append((group,ids,center))
    size=256; cols=math.ceil(math.sqrt(len(chosen))); dim=cols*size
    base=np.ones((dim,dim,4),dtype=np.float32)
    glow=np.ones_like(base);glow[:,:,:3]=0
    uv=mesh.uv_layers.get('PaintedInkUV') or mesh.uv_layers.new(name='PaintedInkUV')
    painted={}; entries=[]
    for index,(group,ids,center) in enumerate(chosen):
        rng=random.Random(917+group.index)
        tx=index%cols;ty=index//cols
        tile=base[ty*size:(ty+1)*size,tx*size:(tx+1)*size]
        emission=glow[ty*size:(ty+1)*size,tx*size:(tx+1)*size]
        xx=[positions[i].dot(right) for i in ids]; yy=[positions[i].dot(up) for i in ids]
        x0,x1=min(xx),max(xx); y0,y1=min(yy),max(yy)
        sx=max(x1-x0,.01); sy=max(y1-y0,.01)
        # Quiet purple pigment gradient; actual light now determines the facets.
        t=np.linspace(0,1,size)[:,None,None]
        low=np.array((.025,.016,.055));high=np.array((.14,.095,.21))
        rgb=low*(1-t)+high*t
        distance=(center-camera.location).length
        fade=np.clip((distance-12)/30,0,.65)
        rgb=rgb*(1-fade)+np.array((.035,.032,.052))*fade
        tile[:,:,:3]=rgb*(.9+rng.random()*.15)
        # Separate incomplete, branching fissures: no polygon-edge tracing,
        # no regular parallel strokes and no cross-hatched shadow areas.
        for mark in range(rng.randint(2,4)):
            u=rng.uniform(.12,.73);v=rng.uniform(.18,.8)
            angle=rng.uniform(0,math.tau);length=rng.uniform(.15,.34)
            path=[(u,v)]
            for step in range(4):
                angle+=rng.uniform(-.8,.8)
                u+=math.cos(angle)*length/4;v+=math.sin(angle)*length/4
                path.append((min(.94,max(.06,u)),min(.94,max(.06,v))))
            stroke(tile,path,rng.uniform(.65,1.3),(.004,.0025,.008))
            p=path[2];q=(p[0]+rng.uniform(-.1,.1),p[1]+rng.uniform(-.1,.1))
            stroke(tile,[p,q],.55,(.006,.004,.011))
        # Architectural damage only: the path moves laterally and branches.
        # Wide components receive a wide fissure; capitals/shafts get different
        # designs instead of a centered identical vertical stripe.
        # Explicit architectural selection excludes rubble and the plant-like
        # props whose source names also happen to begin with pCube.
        architecture={'pCylinder4.004','pCylinder4.008','pCube2.004',
                      'pCube2.008','pCube18','pCube18.001','pCube3'}
        is_glowing=objname.startswith('Arena') and group.name in architecture
        if is_glowing:
            if sx>sy*1.5:
                path=[(.09,.63),(.26,.57),(.34,.7),(.49,.43),(.67,.47),(.79,.29),(.91,.35)]
            else:
                path=[(.16,.89),(.34,.8),(.7,.73),(.58,.59),(.77,.49),(.42,.36),(.29,.18)]
            # Unique off-center branching, including the uppermost stone.
            path=[(min(.97,max(.03,u+rng.uniform(-.11,.11))),
                   min(.98,max(.02,v+rng.uniform(-.08,.08)))) for u,v in path]
            if 'pCylinder4' in group.name:path[0]=(path[0][0],.98)
            if group.index%2:path=[(1-u,v) for u,v in path]
            branches=[path,[path[2],(rng.uniform(.72,.89),rng.uniform(.72,.9)),(.97,rng.uniform(.65,.8))],
                      [path[4],(rng.uniform(.08,.3),rng.uniform(.25,.44))]]
            for p in branches:
                stroke(tile,p,2.7,(.016,.008,.019))
                stroke(emission,p,1.05,(1,.43,.055))
            crack_lights.append(tuple(center-forward*.22))
            entries.append(group.name)
        for i in ids:
            p=positions[i]
            painted[i]=((tx+.035+.93*(p.dot(right)-x0)/sx)/cols,(ty+.035+.93*(p.dot(up)-y0)/sy)/cols)
    albedo=image('Painted_'+objname+'_Ink',base);emissive=image('Painted_'+objname+'_Emission',glow)
    m=bpy.data.materials.new('Painted ink stone • '+objname);m.use_nodes=True
    nt=m.node_tree;bs=nt.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=.96;bs.inputs['Specular IOR Level'].default_value=.08
    uvnode=nt.nodes.new('ShaderNodeUVMap');uvnode.uv_map=uv.name
    for img,socket in [(albedo,'Base Color'),(emissive,'Emission Color')]:
        node=nt.nodes.new('ShaderNodeTexImage');node.image=img
        nt.links.new(uvnode.outputs['UV'],node.inputs['Vector']);nt.links.new(node.outputs['Color'],bs.inputs[socket])
    bs.inputs['Emission Strength'].default_value=7
    slot=len(mesh.materials);mesh.materials.append(m)
    for face in mesh.polygons:
        if all(i in painted for i in face.vertices):
            face.material_index=slot
            for li in face.loop_indices:uv.data[li].uv=painted[mesh.loops[li].vertex_index]
    records.append({'object':objname,'painted_parts':len(chosen),'emissive_architecture':entries,'atlas_size':dim})

# Existing rune emission is texture based; keep it bright with a warm core.
for name in ['polySurface11','polySurface14','pTorus3']:
    bpy.data.objects[name].data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=7

# Clear the old broad, evenly distributed fill lights.
for o in list(scene.objects):
    if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
def light(name,kind,loc,color,power,size,target=None):
    bpy.ops.object.light_add(type=kind,location=loc);o=bpy.context.object;o.name=name
    o.data.color=color;o.data.energy=power
    if kind=='AREA':o.data.size=size
    else:o.data.shadow_soft_size=size
    if target:o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o
light('Cool moon • directional soft key','AREA',(-4,1,7),(.49,.53,.72),400,3,(0,2,0))
light('Violet back rim','AREA',(3,5,5),(.34,.22,.65),190,2,(0,0,1.6))
light('Character magic • warm platform pool','POINT',(0,-.1,.35),(1,.46,.12),38,.65)
light('Character magic • faint armor bounce','POINT',(-.5,-.4,1.7),(1,.45,.14),9,.5)
for x in [-.95,.95]:light('Ring runes • local stone spill','POINT',(x,1.9,.9),(1,.43,.1),13,.3)
for pos in crack_lights:light('Architectural fissure • local spill','POINT',pos,(1,.39,.075),5,.22)
world=scene.world;world.node_tree.nodes['Background'].inputs[0].default_value=(.004,.005,.012,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.12

# Bounded cool haze starts behind the hero: nearby stones remain crisp and
# distant architecture loses contrast through real participating atmosphere.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,34,7))
fog=bpy.context.object;fog.name='Atmosphere • cool distant ruin haze';fog.scale=(70,62,18)
m=bpy.data.materials.new('Atmosphere • distance haze');m.use_nodes=True
nt=m.node_tree;nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');volume=nt.nodes.new('ShaderNodeVolumePrincipled')
volume.inputs['Color'].default_value=(.25,.28,.40,1);volume.inputs['Density'].default_value=.022
volume.inputs['Anisotropy'].default_value=.2;nt.links.new(volume.outputs['Volume'],out.inputs['Volume']);fog.data.materials.append(m)
scene.cycles.samples=72
glare=scene.compositing_node_group.nodes.get('Glare')
glare.inputs['Threshold'].default_value=.8;glare.inputs['Strength'].default_value=.8;glare.inputs['Size'].default_value=.16
scene.render.filepath=str(OUT/'arena-painted-atmosphere.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(o!=fog and (o.type=='MESH' or o==camera or (o.type=='LIGHT' and o.data.type=='POINT')))
bpy.ops.export_scene.gltf(filepath=str(OUT/'arena-painted-atmosphere.glb'),export_format='GLB',use_selection=True,export_cameras=True,export_lights=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arena-painted-atmosphere.blend'))
(OUT/'painted-atmosphere-notes.json').write_text(json.dumps({'ink':'PNG albedo texture strokes; no environment line geometry or hatch shading','cracks':'PNG emission textures on architecture only','atlases':records,'camera_and_model_placements':'inherited unchanged from arena-stylized.blend','atmosphere':'Blender volume; use distance fog in Three.js'},indent=2))
